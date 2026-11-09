package torrentstream

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"path"
	"sync"
	"time"

	"seanime/internal/database/models"
	"seanime/internal/util"

	"github.com/anacrolix/torrent"
	"github.com/anacrolix/torrent/metainfo"
	"github.com/rs/zerolog"
)

const (
	MaxSeedingDuration = 14 * 24 * time.Hour // 2 weeks of seeding
	TargetSeedingRatio = 1.0                 // Seed until 1.0 ratio
)

type (
	SeedingManager struct {
		client     *Client
		logger     *zerolog.Logger
		mu         sync.RWMutex
		items      map[metainfo.Hash]*seedingItem
		lastLog    time.Time
		lastDbSync time.Time
	}

	seedingItem struct {
		InfoHash         metainfo.Hash
		Name             string
		MagnetUri        string
		StartedSeedingAt time.Time
		BytesDownloaded  int64
		BytesUploaded    int64
		BaseUploaded     int64 // Uploaded from previous sessions
		Torrent          *torrent.Torrent
	}
)

func NewSeedingManager(client *Client) *SeedingManager {
	return &SeedingManager{
		client:     client,
		logger:     client.repository.logger,
		items:      make(map[metainfo.Hash]*seedingItem),
		lastLog:    time.Now(),
		lastDbSync: time.Now(),
	}
}

// TrackTorrent registers or updates a torrent for long-term seeding.
func (sm *SeedingManager) TrackTorrent(t *torrent.Torrent, magnetUri string) {
	if t == nil {
		return
	}

	infoHash := t.InfoHash()
	name := t.Name()
	if name == "" && t.Info() != nil {
		name = t.Info().Name
	}

	if magnetUri == "" {
		magnetUri = sm.buildMagnetUri(t)
	}

	sm.mu.Lock()
	defer sm.mu.Unlock()

	item, exists := sm.items[infoHash]
	now := time.Now()

	if !exists {
		item = &seedingItem{
			InfoHash:         infoHash,
			Name:             name,
			MagnetUri:        magnetUri,
			StartedSeedingAt: now,
			BytesDownloaded:  t.BytesCompleted(),
			BytesUploaded:    0,
			BaseUploaded:     0,
			Torrent:          t,
		}
		sm.items[infoHash] = item

		sm.logger.Info().
			Str("infoHash", infoHash.HexString()).
			Str("name", name).
			Msg("torrentstream: Registered torrent for long-term seeding (target ratio: 1.0 or 14 days)")

		// Save to database
		go func() {
			dbItem := &models.TorrentstreamSeedingTorrent{
				InfoHash:         infoHash.HexString(),
				Name:             name,
				MagnetUri:        magnetUri,
				StartedSeedingAt: now,
				BytesDownloaded:  t.BytesCompleted(),
				BytesUploaded:    0,
				Active:           true,
			}
			if err := sm.client.repository.db.UpsertTorrentstreamSeedingTorrent(dbItem); err != nil {
				sm.logger.Error().Err(err).Msg("torrentstream: Failed to persist seeding torrent to database")
			}
		}()
	} else {
		item.Torrent = t
		if name != "" {
			item.Name = name
		}
		if magnetUri != "" {
			item.MagnetUri = magnetUri
		}
		if t.BytesCompleted() > item.BytesDownloaded {
			item.BytesDownloaded = t.BytesCompleted()
		}
	}
}

// IsLongTermSeeding returns true if the torrent is being seeded long-term.
func (sm *SeedingManager) IsLongTermSeeding(hash metainfo.Hash) bool {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	_, exists := sm.items[hash]
	return exists
}

// GetActiveHashes returns all info hashes currently tracked for seeding.
func (sm *SeedingManager) GetActiveHashes() []metainfo.Hash {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	hashes := make([]metainfo.Hash, 0, len(sm.items))
	for h := range sm.items {
		hashes = append(hashes, h)
	}
	return hashes
}

// RestoreAndCleanup loads active seeding torrents from the database, resumes them,
// and deletes orphaned directories from DownloadDir.
func (sm *SeedingManager) RestoreAndCleanup(tc *torrent.Client, downloadDir string) {
	if sm.client.repository.db == nil || tc == nil {
		return
	}

	records, err := sm.client.repository.db.GetActiveTorrentstreamSeedingTorrents()
	if err != nil {
		sm.logger.Error().Err(err).Msg("torrentstream: Failed to load seeding torrents from database")
		return
	}

	activeHashes := make(map[string]bool)
	now := time.Now()

	for _, record := range records {
		var hash metainfo.Hash
		hash.FromHexString(record.InfoHash)

		// Check if it already expired
		elapsed := now.Sub(record.StartedSeedingAt)
		ratio := float64(0)
		if record.BytesDownloaded > 0 {
			ratio = float64(record.BytesUploaded) / float64(record.BytesDownloaded)
		}

		if ratio >= TargetSeedingRatio || elapsed >= MaxSeedingDuration {
			sm.logger.Info().
				Str("infoHash", record.InfoHash).
				Str("name", record.Name).
				Float64("ratio", ratio).
				Dur("elapsed", elapsed).
				Msg("torrentstream: Seeding criteria met during downtime, cleaning up")

			_ = sm.client.repository.db.DeactivateTorrentstreamSeedingTorrent(record.InfoHash)
			_ = os.RemoveAll(path.Join(downloadDir, hash.HexString()))
			continue
		}

		// Re-add to torrent client
		spec, err := sm.specFromRecord(record)
		if err != nil {
			sm.logger.Warn().Err(err).Str("infoHash", record.InfoHash).Msg("torrentstream: Could not parse magnet URI for seeding torrent")
			continue
		}

		t, _, err := tc.AddTorrentSpec(spec)
		if err != nil {
			sm.logger.Error().Err(err).Str("infoHash", record.InfoHash).Msg("torrentstream: Failed to resume seeding torrent")
			continue
		}

		activeHashes[hash.HexString()] = true

		sm.mu.Lock()
		sm.items[hash] = &seedingItem{
			InfoHash:         hash,
			Name:             record.Name,
			MagnetUri:        record.MagnetUri,
			StartedSeedingAt: record.StartedSeedingAt,
			BytesDownloaded:  record.BytesDownloaded,
			BytesUploaded:    record.BytesUploaded,
			BaseUploaded:     record.BytesUploaded,
			Torrent:          t,
		}
		sm.mu.Unlock()

		// Background watcher to deprioritize new pieces and ensure seeding
		go func(targetTorrent *torrent.Torrent, r *models.TorrentstreamSeedingTorrent) {
			select {
			case <-targetTorrent.GotInfo():
				// Stop downloading new pieces, only seed existing ones
				for _, f := range targetTorrent.Files() {
					f.SetPriority(torrent.PiecePriorityNone)
				}
				sm.logger.Info().
					Str("infoHash", r.InfoHash).
					Str("name", targetTorrent.Name()).
					Int64("completedBytes", targetTorrent.BytesCompleted()).
					Msg("torrentstream: Successfully resumed long-term seeding")
			case <-time.After(2 * time.Minute):
				sm.logger.Warn().Str("infoHash", r.InfoHash).Msg("torrentstream: Timeout loading metadata for resumed seeding torrent")
			}
		}(t, record)
	}

	// Clean up orphaned folders in download directory
	if downloadDir != "" {
		entries, err := os.ReadDir(downloadDir)
		if err == nil {
			for _, entry := range entries {
				if entry.IsDir() && !activeHashes[entry.Name()] {
					sm.logger.Debug().Str("dir", entry.Name()).Msg("torrentstream: Cleaning up orphaned torrent download directory")
					_ = os.RemoveAll(path.Join(downloadDir, entry.Name()))
				}
			}
		}
	}

	sm.logger.Info().Int("count", len(activeHashes)).Msg("torrentstream: Long-term seeding torrents restored")
}

// BackgroundWorker monitors all seeding torrents, calculates upload/download ratios,
// and drops torrents once ratio >= 1.0 or 14 days of active seeding have elapsed.
func (sm *SeedingManager) BackgroundWorker(ctx context.Context) {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			sm.SaveAllStats()
			return
		case <-ticker.C:
			sm.evaluateSeeding()
		}
	}
}

func (sm *SeedingManager) evaluateSeeding() {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	if len(sm.items) == 0 {
		return
	}

	now := time.Now()
	shouldLog := now.Sub(sm.lastLog) >= 30*time.Second
	shouldSyncDb := now.Sub(sm.lastDbSync) >= 60*time.Second

	toRemove := make([]metainfo.Hash, 0)

	for hash, item := range sm.items {
		t := item.Torrent
		if t == nil {
			continue
		}

		completed := t.BytesCompleted()
		if completed > item.BytesDownloaded {
			item.BytesDownloaded = completed
		}

		stats := t.Stats()
		sessionUploaded := (&stats.BytesWrittenData).Int64()
		totalUploaded := item.BaseUploaded + sessionUploaded
		item.BytesUploaded = totalUploaded

		var ratio float64
		if item.BytesDownloaded > 0 {
			ratio = float64(totalUploaded) / float64(item.BytesDownloaded)
		}

		elapsed := now.Sub(item.StartedSeedingAt)
		isRatioMet := ratio >= TargetSeedingRatio
		isTimeMet := elapsed >= MaxSeedingDuration

		// Check if torrent is currently playing
		isCurrentlyPlaying := false
		if sm.client.currentTorrent.IsPresent() && sm.client.currentTorrent.MustGet().InfoHash() == hash {
			isCurrentlyPlaying = true
		}
		if sm.client.repository.preloadedStream.IsPresent() && sm.client.repository.preloadedStream.MustGet().Torrent.InfoHash() == hash {
			isCurrentlyPlaying = true
		}

		if (isRatioMet || isTimeMet) && !isCurrentlyPlaying {
			reason := "ratio 1.0 reached"
			if isTimeMet {
				reason = "2 weeks seeding duration elapsed"
			}

			sm.logger.Info().
				Str("infoHash", hash.HexString()).
				Str("name", item.Name).
				Float64("ratio", ratio).
				Dur("duration", elapsed).
				Str("reason", reason).
				Msg("torrentstream: Seeding policy completed! Dropping torrent and freeing storage")

			t.Drop()
			sm.client.removeTorrentFiles(hash)

			// Deactivate in DB
			go func(h string) {
				_ = sm.client.repository.db.DeactivateTorrentstreamSeedingTorrent(h)
			}(hash.HexString())

			toRemove = append(toRemove, hash)
			continue
		}

		if shouldLog {
			sm.logger.Info().
				Str("name", item.Name).
				Float64("ratio", ratio).
				Str("timeSeeding", fmt.Sprintf("%.1fd/14d", elapsed.Hours()/24)).
				Str("uploaded", util.Bytes(uint64(totalUploaded))).
				Str("downloaded", util.Bytes(uint64(item.BytesDownloaded))).
				Int("peers", t.Stats().ActivePeers).
				Msg("torrentstream: [Long-Term Seeding]")
		}

		if shouldSyncDb {
			go func(h string, dl int64, ul int64) {
				_ = sm.client.repository.db.UpdateTorrentstreamSeedingStats(h, dl, ul)
			}(hash.HexString(), item.BytesDownloaded, item.BytesUploaded)
		}
	}

	for _, h := range toRemove {
		delete(sm.items, h)
	}

	if shouldLog {
		sm.lastLog = now
	}
	if shouldSyncDb {
		sm.lastDbSync = now
	}
}

// SaveAllStats persists current upload and download stats to the database.
func (sm *SeedingManager) SaveAllStats() {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	for hash, item := range sm.items {
		if item.Torrent != nil {
			stats := item.Torrent.Stats()
			sessionUploaded := (&stats.BytesWrittenData).Int64()
			item.BytesUploaded = item.BaseUploaded + sessionUploaded
			if item.Torrent.BytesCompleted() > item.BytesDownloaded {
				item.BytesDownloaded = item.Torrent.BytesCompleted()
			}
		}

		_ = sm.client.repository.db.UpdateTorrentstreamSeedingStats(
			hash.HexString(),
			item.BytesDownloaded,
			item.BytesUploaded,
		)
	}
}

func (sm *SeedingManager) buildMagnetUri(t *torrent.Torrent) string {
	infoHash := t.InfoHash().HexString()
	name := t.Name()
	if name == "" && t.Info() != nil {
		name = t.Info().Name
	}

	magnetUri := fmt.Sprintf("magnet:?xt=urn:btih:%s&dn=%s", infoHash, url.QueryEscape(name))
	for _, trList := range getSupplementalTrackers() {
		for _, tr := range trList {
			magnetUri += "&tr=" + url.QueryEscape(tr)
		}
	}

	return magnetUri
}

func (sm *SeedingManager) specFromRecord(record *models.TorrentstreamSeedingTorrent) (*torrent.TorrentSpec, error) {
	if record.MagnetUri != "" {
		return torrent.TorrentSpecFromMagnetUri(record.MagnetUri)
	}

	var hash metainfo.Hash
	hash.FromHexString(record.InfoHash)
	return &torrent.TorrentSpec{
		InfoHash:    hash,
		DisplayName: record.Name,
		Trackers:    getSupplementalTrackers(),
	}, nil
}
