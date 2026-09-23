use super::{AgentId, DevelopmentAgent, GizmoAgent, SreAgent};

#[test]
fn team_membership_and_coordinators_survive_round_trips() -> serde_json::Result<()> {
    for agent in [
        AgentId::Gizmo(GizmoAgent::GizmoPrime),
        AgentId::Gizmo(GizmoAgent::Gizmo),
        AgentId::Development(DevelopmentAgent::RustDev),
        AgentId::Sre(SreAgent::DockerSpecialist),
    ] {
        let encoded = serde_json::to_string(&agent)?;
        assert_eq!(serde_json::from_str::<AgentId>(&encoded)?, agent);
    }
    Ok(())
}

#[test]
fn decoder_rejects_cross_team_roles_flat_names_and_invented_identities() {
    for input in [
        r#"{"team":"Sre","role":"RustDev"}"#,
        r#"{"team":"Development","role":"DockerSpecialist"}"#,
        r#"{"team":"Gizmo","role":"RustDev"}"#,
        r#"{"team":"Delivery","role":"Gizmo"}"#,
        r#"{"team":"Ai","role":"SecurityAgent"}"#,
        r#"{"team":"Security","role":"TechWriter"}"#,
        r#"{"team":"Unknown","role":"RustDev"}"#,
        r#"{"team":"Development","role":"RustDev2"}"#,
        r#"{"team":"Sre"}"#,
        r#"{"role":"RustDev"}"#,
        r#"{"team":"Sre","role":"DockerSpecialist","extra":"RustDev"}"#,
        r#""rust-dev""#,
        r#""gizmo""#,
        r#""worker""#,
        r#""reviewer""#,
        r#""rust-dev-2""#,
        r#""""#,
        "null",
    ] {
        assert!(serde_json::from_str::<AgentId>(input).is_err(), "{input}");
    }
}
