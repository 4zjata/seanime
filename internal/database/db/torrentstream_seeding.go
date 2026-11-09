package db

import (
	"time"

	"seanime/internal/database/models"

	"gorm.io/gorm/clause"
)

func (db *Database) GetActiveTorrentstreamSeedingTorrents() ([]*models.TorrentstreamSeedingTorrent, error) {
	var torrents []*models.TorrentstreamSeedingTorrent
	err := db.gormdb.Where("active = ?", true).Order("started_seeding_at desc").Find(&torrents).Error
	return torrents, err
}

func (db *Database) UpsertTorrentstreamSeedingTorrent(torrent *models.TorrentstreamSeedingTorrent) error {
	return db.gormdb.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "info_hash"}},
		DoUpdates: clause.AssignmentColumns([]string{"name", "magnet_uri", "bytes_downloaded", "bytes_uploaded", "active", "completed_at", "updated_at"}),
	}).Create(torrent).Error
}

func (db *Database) UpdateTorrentstreamSeedingStats(infoHash string, downloaded int64, uploaded int64) error {
	return db.gormdb.Model(&models.TorrentstreamSeedingTorrent{}).
		Where("info_hash = ?", infoHash).
		Updates(map[string]interface{}{
			"bytes_downloaded": downloaded,
			"bytes_uploaded":   uploaded,
			"updated_at":       time.Now(),
		}).Error
}

func (db *Database) DeactivateTorrentstreamSeedingTorrent(infoHash string) error {
	now := time.Now()
	return db.gormdb.Model(&models.TorrentstreamSeedingTorrent{}).
		Where("info_hash = ?", infoHash).
		Updates(map[string]interface{}{
			"active":       false,
			"completed_at": &now,
			"updated_at":   now,
		}).Error
}
