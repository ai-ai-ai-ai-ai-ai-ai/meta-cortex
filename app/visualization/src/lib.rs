//! Native desktop and headless Snapshot presentation of recorded Workbench data; no host runtime or Git content collection.
mod dashboard;
pub use dashboard::{
    Dashboard, DashboardError, DashboardExecution, DashboardMode, DashboardReport,
    DashboardRequest, DashboardView, DesktopContent, DesktopContract, DesktopFailure,
    DesktopLaunch, DesktopRead, DesktopReply, DesktopSelection,
};
