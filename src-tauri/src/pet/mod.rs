//! Pet domain models and P2 extension points (R-13 multi-pet, R-15 mood/growth,
//! R-16 cloud-sync interface). The active frontend animation state machine is
//! implemented in TypeScript (`src/pet/petStateMachine.ts`); this Rust mirror
//! keeps the same transition rules so `cargo test` can verify them and a future
//! native backend can reuse them.

pub mod sync;

use serde::{Deserialize, Serialize};

pub use crate::config::model::PetProfile;

/// Pet animation states — must stay in sync with the frontend `PetState` union.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PetState {
    Idle,
    Walk,
    Sleep,
    Play,
}

/// Validate a state transition against the PRD state diagram
/// (Idle -> {Walk,Sleep,Play}; {Walk,Sleep,Play} -> Idle; self -> self).
pub fn can_transition(from: PetState, to: PetState) -> bool {
    use PetState::*;
    match (from, to) {
        (a, b) if a == b => true,
        (Idle, Walk) | (Idle, Sleep) | (Idle, Play) => true,
        (Walk, Idle) => true,
        (Sleep, Idle) => true,
        (Play, Idle) => true,
        _ => false,
    }
}

/// Behaviour contract for any pet (single or multi, R-13).
pub trait PetProvider {
    fn id(&self) -> &str;
    fn name(&self) -> &str;
}

impl PetProvider for PetProfile {
    fn id(&self) -> &str {
        &self.id
    }
    fn name(&self) -> &str {
        &self.name
    }
}

/// In-memory registry of pets (v1: one entry; reserved for multi-pet, R-13).
#[derive(Default)]
pub struct PetRegistry {
    pets: Vec<PetProfile>,
}

impl PetRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register(&mut self, pet: PetProfile) {
        if self.get(&pet.id).is_none() {
            self.pets.push(pet);
        }
    }

    pub fn get(&self, id: &str) -> Option<&PetProfile> {
        self.pets.iter().find(|p| p.id == id)
    }

    pub fn list(&self) -> &[PetProfile] {
        &self.pets
    }
}

/// Mood / intimacy growth stub (R-15). Pure, deterministic, unit-tested.
#[derive(Debug, Clone, Default)]
pub struct PetMood {
    pub intimacy: u32,
    pub level: u32,
}

impl PetMood {
    pub fn new() -> Self {
        Self {
            intimacy: 0,
            level: 1,
        }
    }

    /// Register one interaction; levels up every `level * 10` interactions.
    pub fn interact(&mut self) {
        self.intimacy += 1;
        if self.intimacy >= self.level * 10 {
            self.intimacy = 0;
            self.level += 1;
        }
    }

    pub fn describe(&self) -> String {
        format!("Lv.{} 亲密度 {}", self.level, self.intimacy)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn transitions_follow_state_diagram() {
        use PetState::*;
        assert!(can_transition(Idle, Walk));
        assert!(can_transition(Idle, Sleep));
        assert!(can_transition(Idle, Play));
        assert!(can_transition(Walk, Idle));
        assert!(can_transition(Sleep, Idle));
        assert!(can_transition(Play, Idle));
        // illegal: e.g. Sleep -> Play directly
        assert!(!can_transition(Sleep, Play));
        assert!(!can_transition(Walk, Sleep));
        // self
        assert!(can_transition(Idle, Idle));
    }

    #[test]
    fn mood_grows() {
        let mut mood = PetMood::new();
        assert_eq!(mood.level, 1);
        for _ in 0..10 {
            mood.interact();
        }
        assert_eq!(mood.level, 2);
        assert_eq!(mood.intimacy, 0);
    }

    #[test]
    fn registry_stores_pets() {
        let mut reg = PetRegistry::new();
        reg.register(PetProfile {
            id: "a".into(),
            name: "A".into(),
            manifest: "m".into(),
        });
        reg.register(PetProfile {
            id: "a".into(),
            name: "Dup".into(),
            manifest: "m".into(),
        });
        assert_eq!(reg.list().len(), 1);
        assert_eq!(reg.get("a").unwrap().name, "A");
    }
}
