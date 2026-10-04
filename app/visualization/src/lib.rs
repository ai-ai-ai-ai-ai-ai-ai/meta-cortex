//! Native desktop and headless Snapshot presentation of recorded Workbench data; no host runtime or Git content collection.
mod dashboard;
pub use dashboard::{
    Dashboard, DashboardError, DashboardExecution, DashboardReport, DashboardRequest,
    DashboardView, DesktopContract, DesktopFailure, DesktopLaunch, DesktopReply,
};
