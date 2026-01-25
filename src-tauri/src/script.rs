use log::{debug, error, info, warn};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;

/// Script version
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptVersion {
    pub version: String,
    pub client_id: String,
    pub name: String,
    pub description: Option<String>,
    pub variables: Vec<String>,
    pub nodes: Vec<ScriptNode>,
    pub widgets: HashMap<String, Widget>,
}

/// Node types in the script
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type")]
pub enum NodeType {
    SCRIPT,
    BRANCH,
    WIDGET,
    COMPLIANCE,
    SCRIPT_AND_WIDGET,
    ACTION,
}

/// Script node
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptNode {
    pub id: String,
    #[serde(rename = "type")]
    pub node_type: String,
    pub config: NodeConfig,
    pub transitions: Vec<Transition>,
}

/// Node configuration (varies by type)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeConfig {
    pub text: Option<String>,
    pub keywords: Option<Vec<String>>,
    pub wait_for_response: Option<bool>,
    pub display_notes: Option<String>,
    pub widget: Option<String>,
    pub auto_trigger: Option<AutoTrigger>,
    pub verbatim_match: Option<f32>,
    pub on_skip: Option<String>,
    pub alert_message: Option<String>,
    pub action: Option<String>,
    pub disposition: Option<String>,
}

/// Auto-trigger configuration for widgets
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoTrigger {
    pub listen_for: Vec<String>,
    pub action: String,
}

/// Transition to next node
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transition {
    pub trigger_type: String,
    pub value: Option<TransitionValue>,
    pub next_node: String,
    pub confidence_threshold: Option<f32>,
}

/// Transition value (can be string or array)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum TransitionValue {
    Single(String),
    Multiple(Vec<String>),
}

/// Widget definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Widget {
    #[serde(rename = "type")]
    pub widget_type: String,
    pub config: serde_json::Value,
}

/// Script engine - manages script state and navigation
pub struct ScriptEngine {
    script: ScriptVersion,
    current_node_id: String,
    node_history: Vec<String>,
    variables: HashMap<String, String>,
}

impl ScriptEngine {
    /// Load script from file
    pub fn load_from_file<P: AsRef<Path>>(path: P) -> Result<Self, String> {
        let content = fs::read_to_string(path.as_ref())
            .map_err(|e| format!("Failed to read script file: {}", e))?;

        let script: ScriptVersion = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse script JSON: {}", e))?;

        Self::validate_script(&script)?;

        info!("Loaded script: {} ({})", script.name, script.version);

        Ok(Self {
            current_node_id: script.nodes[0].id.clone(),
            script,
            node_history: Vec::new(),
            variables: HashMap::new(),
        })
    }

    /// Validate script structure
    fn validate_script(script: &ScriptVersion) -> Result<(), String> {
        if script.nodes.is_empty() {
            return Err("Script must have at least one node".to_string());
        }

        // Check for orphaned nodes (no transitions pointing to them, except first node)
        let mut reachable_nodes = std::collections::HashSet::new();
        reachable_nodes.insert(script.nodes[0].id.clone());

        for node in &script.nodes {
            for transition in &node.transitions {
                reachable_nodes.insert(transition.next_node.clone());
            }
        }

        let unreachable: Vec<_> = script
            .nodes
            .iter()
            .filter(|n| !reachable_nodes.contains(&n.id))
            .map(|n| &n.id)
            .collect();

        if !unreachable.is_empty() {
            warn!("Orphaned nodes detected: {:?}", unreachable);
        }

        // Check for invalid node references
        let node_ids: std::collections::HashSet<_> = script.nodes.iter().map(|n| &n.id).collect();

        for node in &script.nodes {
            for transition in &node.transitions {
                if !node_ids.contains(&transition.next_node) {
                    return Err(format!(
                        "Node '{}' references non-existent node '{}'",
                        node.id, transition.next_node
                    ));
                }
            }
        }

        debug!("Script validation passed: {} nodes", script.nodes.len());
        Ok(())
    }

    /// Get current node
    pub fn current_node(&self) -> Option<&ScriptNode> {
        self.script.nodes.iter().find(|n| n.id == self.current_node_id)
    }

    /// Get script name
    pub fn get_name(&self) -> &str {
        &self.script.name
    }

    /// Get script version
    pub fn get_version(&self) -> &str {
        &self.script.version
    }

    /// Get all nodes (for UI rendering)
    pub fn get_all_nodes(&self) -> &[ScriptNode] {
        &self.script.nodes
    }

    /// Get current node ID
    pub fn get_current_node_id(&self) -> &str {
        &self.current_node_id
    }

    /// Get node history
    pub fn get_history(&self) -> &[String] {
        &self.node_history
    }

    /// Navigate to specific node (manual override)
    pub fn navigate_to(&mut self, node_id: &str) -> Result<(), String> {
        if !self.script.nodes.iter().any(|n| n.id == node_id) {
            return Err(format!("Node '{}' not found", node_id));
        }

        self.node_history.push(self.current_node_id.clone());
        self.current_node_id = node_id.to_string();

        info!("Navigated to node: {}", node_id);
        Ok(())
    }

    /// Find next node based on transcript keywords
    pub fn match_keywords(&self, transcript: &str) -> Option<String> {
        let current = self.current_node()?;
        let transcript_lower = transcript.to_lowercase();

        // Check each transition
        for transition in &current.transitions {
            if transition.trigger_type == "AUTO" {
                return Some(transition.next_node.clone());
            }

            if let Some(ref value) = transition.value {
                let keywords = match value {
                    TransitionValue::Single(s) => vec![s.as_str()],
                    TransitionValue::Multiple(v) => v.iter().map(|s| s.as_str()).collect(),
                };

                // Check if any keyword appears in transcript
                for keyword in keywords {
                    if transcript_lower.contains(&keyword.to_lowercase()) {
                        debug!(
                            "Matched keyword '{}' -> node '{}'",
                            keyword, transition.next_node
                        );
                        return Some(transition.next_node.clone());
                    }
                }
            }
        }

        None
    }

    /// Process transcript and auto-navigate if keywords match
    pub fn process_transcript(&mut self, transcript: &str) -> Option<String> {
        if let Some(next_node) = self.match_keywords(transcript) {
            if self.navigate_to(&next_node).is_ok() {
                return Some(next_node);
            }
        }
        None
    }

    /// Set variable value
    pub fn set_variable(&mut self, name: &str, value: String) {
        debug!("Set variable: {} = {}", name, value);
        self.variables.insert(name.to_string(), value);
    }

    /// Render text with variable substitution
    pub fn render_text(&self, template: &str) -> String {
        let mut result = template.to_string();

        for (name, value) in &self.variables {
            let placeholder = format!("{{{{{}}}}}", name);
            result = result.replace(&placeholder, value);
        }

        result
    }

    /// Get widget configuration
    pub fn get_widget(&self, widget_id: &str) -> Option<&Widget> {
        self.script.widgets.get(widget_id)
    }

    /// Get next possible nodes (for UI preview)
    pub fn get_next_nodes(&self) -> Vec<&ScriptNode> {
        let current = match self.current_node() {
            Some(n) => n,
            None => return Vec::new(),
        };

        current
            .transitions
            .iter()
            .filter_map(|t| self.script.nodes.iter().find(|n| n.id == t.next_node))
            .collect()
    }

    /// Go back to previous node
    pub fn navigate_back(&mut self) -> Result<(), String> {
        if let Some(prev_node) = self.node_history.pop() {
            self.current_node_id = prev_node;
            info!("Navigated back to: {}", self.current_node_id);
            Ok(())
        } else {
            Err("No previous node in history".to_string())
        }
    }

    /// Reset to beginning
    pub fn reset(&mut self) {
        self.current_node_id = self.script.nodes[0].id.clone();
        self.node_history.clear();
        self.variables.clear();
        info!("Script reset to beginning");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_render_text() {
        let mut engine = ScriptEngine {
            script: ScriptVersion {
                version: "1.0.0".to_string(),
                client_id: "TEST".to_string(),
                name: "Test".to_string(),
                description: None,
                variables: vec![],
                nodes: vec![],
                widgets: HashMap::new(),
            },
            current_node_id: "test".to_string(),
            node_history: vec![],
            variables: HashMap::new(),
        };

        engine.set_variable("customer_name", "John".to_string());
        engine.set_variable("agent_name", "Sarah".to_string());

        let text = "Hi {{customer_name}}, this is {{agent_name}} calling.";
        let rendered = engine.render_text(text);

        assert_eq!(rendered, "Hi John, this is Sarah calling.");
    }

    #[test]
    fn test_keyword_matching() {
        // Test would require loading a real script
        // Left as integration test
    }
}
