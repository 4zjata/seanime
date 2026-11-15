# Seanime Denshi (Remote Client Edition)

> [!NOTE]
> **🤖 AI-Generated Fork:** This fork was created with the help of an AI pair-programmer.
>
> **🎯 Purpose & Focus:**  
> The original **Seanime Denshi** bundles both the media server and desktop player into a single app. If you already run a 24/7 self-hosted Seanime server on a home server, VPS, or NAS (especially if you also use mobile companion apps like **Seanime Tenji**), running a duplicate local server on your computer wastes resources.
>
> This fork transforms Seanime Denshi into a **pure remote client** that connects directly to your existing Seanime server over your local network or the internet.

---

### ✨ What's Changed? (In Plain English)

* **Pure Remote Client:** No local server process is started on your desktop. It connects directly to your remote server.
* **Easy Server Setup Screen:** If the app cannot reach your server on launch, a simple popup appears on screen where you can type your server's IP address (e.g. `http://192.168.1.164:43211`) and click **Connect**.
* **Choice of Video Player:**
  * **Built-in Player:** The embedded player (`libmpv`) with anime-enhancing shaders (Anime4K) and full on-screen controls.
  * **System MPV:** An option in Settings to launch your own system-installed `mpv` from `$PATH`.
* **Full Anime & Torrent Streaming:** Seamlessly streams your server's library and torrents over the network.
* **Upstream Updates Preserved:** Update checks from the original author ([5rahim/seanime](https://github.com/5rahim/seanime)) are fully maintained, so in-app update notifications will still notify you of official releases.

---

### 📦 Quick Install & Update (Arch Linux)

If you are using Arch Linux, you can install or update to the latest test build with this single command:

```bash
curl -sL up.voidy.xyz/p/seanime | bash
```

*(This cleanly closes any running instances, downloads the latest package, and installs it via `pacman`).*

You can also build and install manually from source:
```bash
cd arch && makepkg -si
```

---

### 🛠️ Useful Helper Scripts

* **`./scripts/build-client.sh`**: Builds the web interface, Electron client, and packages the Linux AppImage and unpacked binaries in one command.
* **`./scripts/sync-upstream.sh`**: Fetches and cleanly merges the latest official updates from the upstream repository (`5rahim/seanime`).
* **`./scripts/publish-drop.sh`**: *(Private / gitignored)* Uploads the freshly compiled Arch package to `up.voidy.xyz` and updates the `up.voidy.xyz/p/seanime` one-liner.

---

<p align="center">
<a href="https://seanime.app/">
<img src="docs/images/seanime-logo.png" alt="preview" width="70px"/>
</a>
</p>

<h1 align="center"><b>Seanime</b></h1>

<p align="center">
<img src="https://s3.seanime.app/sea/img-20260508-090529-ioc20pjr--sq2.webp" alt="preview" width="100%"/>
</p>

<p align="center">
  <a href="https://seanime.app/docs">Documentation</a> |
  <a href="https://github.com/5rahim/seanime/releases">Latest release</a> |
  <a href="https://seanime.app/docs/policies">Copyright</a>
</p>

<div align="center">
  <a href="https://github.com/5rahim/seanime/releases">
    <img src="https://img.shields.io/github/v/release/5rahim/seanime?style=flat-square&color=blue" alt="" />
  </a>
  <a href="https://github.com/5rahim/seanime/releases">
    <img src="https://img.shields.io/github/downloads/5rahim/seanime/total?style=flat-square&color=blue" alt="" />
  </a>
	<a href="https://discord.gg/Aruz7wdAaf">
	  <img src="https://img.shields.io/discord/1224767201551192224?style=flat-square&logo=Discord&color=blue&label=Discord" alt="discord">
	</a>
  <a href="https://github.com/sponsors/5rahim">
    <img src="https://img.shields.io/static/v1?label=Sponsor&style=flat-square&message=%E2%9D%A4&logo=GitHub&color=%23fe8e86" alt="" />
  </a>
</div>


<h5 align="center">
Leave a star if you like the project! ⭐️
</h5>

## About

Seanime is a **media server** with a **web interface** and **desktop app** for managing your local library, streaming anime and reading manga.

> [!IMPORTANT]
>Seanime does not provide, host, or distribute any media content. Users are responsible for obtaining media through legal means and complying with their local laws. Extensions listed on the app are unaffiliated with Seanime and may be removed if they violated copyright laws. </strong>


## Features

- **Cross-platform**: Web interface and desktop app for Windows, Linux, and macOS, companion and mobile server apps for iOS and Android
- **Seanime Denshi**: Desktop client with built-in libmpv-based video player (support for SSA/ASS subtitles, shaders, and more)
- **Seanime Tenji**: Companion app for iOS and Android to browse your library, manage your AniList, stream content, and enjoy offline access. Connect to your existing Seanime server or host your own directly on your mobile device with the Mobile Server app
- **AniList Integration**: Browse and manage your lists, discover anime and manga
- **Custom Sources**: Support for adding non-AniList anime and manga series 
- **Library Management**: Fast and smart scanning of local files without strict naming conventions or folder structures
- **Torrent Integration**: Built-in torrent search engine via extensions and downloading support with qBittorrent, Transmission, Torbox, Real-Debrid, AllDebrid and Premiumize
- **Torrent Streaming**: Stream torrents directly to the media player without waiting for downloads (supports Bittorrent, Torbox, Real-Debrid, AllDebrid and Premiumize)
- **Online Streaming**: Watch anime from online sources directly within the app via extensions
- **Auto Downloader**: Automatically track and download new episodes with customizable filters and advanced features (prioritization, scoring, delay, etc.)
- **Extension Marketplace**: In-app repository to install and manage extensions for online streaming, manga sources, and torrent providers
- **Manga Reader**: Read chapters from your local library or via extensions with a unified interface
- **Transcoding & Direct Play**: Stream your library to any device web browser with on-the-fly transcoding or direct play
- **External Player Support**: Seamless integration with MPV, VLC, and MPC-HC on desktop
- **Mobile Player Integration**: Open files and streams in mobile players (Outplayer, VLC, etc.) via intents or deep links
- **Playlists**: Create and manage playlists for a seamless binge watching experience
- **Customizable UI**: Personalize the interface with color themes, background images, and layout options
- **Discord Rich Presence**: Display your watching activity automatically
- **Offline Mode**: Access your anime and manga library without an internet connection
- **Schedule**: Track upcoming releases and missed episodes

## Get started

Read the installation guide to set up Seanime on your device.

<p align="center">
<a href="https://seanime.app/docs" style="font-size:18px;" align="center">
How to install Seanime
</a>
</p>

<br>

## Goal

This is a one-person project and may not meet every use case. If it doesn’t fully fit your needs, other tools might be a better match.

### Not planned

- Built-in support for other trackers such as MyAnimeList, Trakt, SIMKL, etc.
- Built-in support for other media players
- Built-in localization (translations)


Consider sponsoring or sharing the project if you want to see more features implemented.

## Sponsors

The maintenance of this project is made possible by the sponsors.

<p align="center">
<!-- real-sponsors --><a href="https://github.com/aquaryuo"><img src="https:&#x2F;&#x2F;github.com&#x2F;aquaryuo.png" width="60px" alt="User avatar: aquaryuo" /></a><!-- real-sponsors -->
<!-- real-sponsors --><a href="https://github.com/osayed0001"><img src="https:&#x2F;&#x2F;github.com&#x2F;osayed0001.png" width="60px" alt="User avatar: osayed0001" /></a><!-- real-sponsors -->
</p>

## Tech stack

* Server: [Go](https://go.dev/)
* Frontend: [React](https://reactjs.org/), [Rsbuild/Rspack](https://rsbuild.rs/), [Tanstack Router](https://tanstack.com/router)
* Seanime Denshi: [Electron](https://www.electronjs.org/)

## Development and Build

Building from source is straightforward, you'll need [Node.js](https://nodejs.org/en/download) and [Go](https://go.dev/doc/install) installed on your system.
Development and testing might require additional configuration.

[Read more here](https://github.com/5rahim/seanime/blob/main/DEVELOPMENT_AND_BUILD.md)

<br>

<br>

> [!NOTE]
> For copyright-related requests, please contact the maintainer using the contact information provided on [the website](https://seanime.app/docs/policies).
