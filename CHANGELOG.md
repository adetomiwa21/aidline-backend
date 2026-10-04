# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-10-04

First public testnet release.

### Added

- Soroban event indexer with transactional cursor and replay safety
- Campaign, donation, release, refund and verifier tables in Postgres
- REST API: campaigns, campaign detail with milestone timeline, releases feed, donors, verifiers, stats, config
- Campaign metadata with organiser, and milestone proof uploads
- Verifier applications
- Demo seed script for testnet
- Embedded Postgres for local development, Dockerfile and Render blueprint
- Tests against a real throwaway Postgres, CI, API and architecture docs
