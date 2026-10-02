//! Terminal presentation of recorded Workbench data; no host runtime or Git content collection.
mod dashboard;
pub use dashboard::{
    Dashboard, DashboardError, DashboardMode, DashboardReport, DashboardRequest, DashboardView,
};
