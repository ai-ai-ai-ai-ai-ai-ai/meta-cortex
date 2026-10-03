import Content from "./sidebar-content.svelte";
import Footer from "./sidebar-footer.svelte";
import GroupLabel from "./sidebar-group-label.svelte";
import Group from "./sidebar-group.svelte";
import Header from "./sidebar-header.svelte";
import Inset from "./sidebar-inset.svelte";
import MenuButton from "./sidebar-menu-button.svelte";
import MenuItem from "./sidebar-menu-item.svelte";
import Menu from "./sidebar-menu.svelte";
import Provider from "./sidebar-provider.svelte";
import Trigger from "./sidebar-trigger.svelte";
import Root from "./sidebar.svelte";
import { useSidebar } from "./context.svelte.js";

export {
  Content,
  Footer,
  Group,
  GroupLabel,
  Header,
  Inset,
  Menu,
  MenuButton,
  MenuItem,
  Provider,
  Root,

  //
  Root as Sidebar,
  Content as SidebarContent,
  Footer as SidebarFooter,
  Group as SidebarGroup,
  GroupLabel as SidebarGroupLabel,
  Header as SidebarHeader,
  Inset as SidebarInset,
  Menu as SidebarMenu,
  MenuButton as SidebarMenuButton,
  MenuItem as SidebarMenuItem,
  Provider as SidebarProvider,
  Trigger as SidebarTrigger,
  Trigger,
  useSidebar,
};
