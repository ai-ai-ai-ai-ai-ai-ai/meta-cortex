use super::CursorApplication;
use serde_saphyr::{SerializeError, to_string};

#[test]
fn cursor_application_preserves_yaml_boolean_values() -> Result<(), SerializeError> {
    assert_eq!(to_string(&CursorApplication::Always)?, "true\n");
    assert_eq!(to_string(&CursorApplication::Conditional)?, "false\n");
    Ok(())
}
