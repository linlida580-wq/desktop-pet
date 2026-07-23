//! Cloud-sync provider interface (R-16, P2 placeholder).
//!
//! The app is fully local (Q7: no account). `SyncProvider` defines the seam so
//! a future cloud backend can be dropped in without touching business logic.
//! `NullSync` is the current no-op implementation.

use crate::config::model::Config;

/// Sync seam. All methods are no-ops by default so a partial implementation is valid.
pub trait SyncProvider {
    /// Push the local config to the cloud.
    fn push(&self, _config: &Config) -> Result<(), String> {
        Ok(())
    }

    /// Pull the remote config, if any.
    fn pull(&self) -> Result<Option<Config>, String> {
        Ok(None)
    }
}

/// Default local-only sync provider.
pub struct NullSync;

impl SyncProvider for NullSync {}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::model::Config;

    #[test]
    fn null_sync_is_noop() {
        let sync = NullSync;
        assert!(sync.push(&Config::default_config()).is_ok());
        assert!(sync.pull().unwrap().is_none());
    }
}
