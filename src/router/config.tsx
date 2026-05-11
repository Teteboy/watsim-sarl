import type { RouteObject } from "react-router-dom";
import NotFound from "../pages/NotFound";
import Home from "../pages/home/page";
import AdminLoginPage from "../pages/admin/login/page";
import AdminDashboard from "../pages/admin/page";
import AdminUsersPage from "../pages/admin/users/page";
import AdminMerchantsPage from "../pages/admin/merchants/page";
import AdminProductsPage from "../pages/admin/products/page";
import AdminTransactionsPage from "../pages/admin/transactions/page";
import AdminBnplPage from "../pages/admin/bnpl/page";
import AdminReportsPage from "../pages/admin/reports/page";
import AdminDisputesPage from "../pages/admin/disputes/page";
import AdminPublicitiesPage from "../pages/admin/publicities/page";
import AdminSettingsPage from "../pages/admin/settings/page";
import AdminNotificationsPage from "../pages/admin/notifications/page";
import AdminGuard from "../components/feature/AdminGuard";
import MerchantLoginPage from "../pages/merchant/login/page";
import MerchantDashboard from "../pages/merchant/page";
import MerchantProductsPage from "../pages/merchant/products/page";
import MerchantOrdersPage from "../pages/merchant/orders/page";
import MerchantBnplPage from "../pages/merchant/bnpl/page";
import MerchantAnalyticsPage from "../pages/merchant/analytics/page";
import MerchantSettingsPage from "../pages/merchant/settings/page";
import MerchantGuard from "../components/feature/MerchantGuard";

const routes: RouteObject[] = [
  {
    path: "/",
    element: <Home />,
  },
  {
    path: "/admin/login",
    element: <AdminLoginPage />,
  },
  {
    path: "/admin",
    element: <AdminGuard><AdminDashboard /></AdminGuard>,
  },
  {
    path: "/admin/users",
    element: <AdminGuard><AdminUsersPage /></AdminGuard>,
  },
  {
    path: "/admin/merchants",
    element: <AdminGuard><AdminMerchantsPage /></AdminGuard>,
  },
  {
    path: "/admin/products",
    element: <AdminGuard><AdminProductsPage /></AdminGuard>,
  },
  {
    path: "/admin/transactions",
    element: <AdminGuard><AdminTransactionsPage /></AdminGuard>,
  },
  {
    path: "/admin/bnpl",
    element: <AdminGuard><AdminBnplPage /></AdminGuard>,
  },
  {
    path: "/admin/reports",
    element: <AdminGuard><AdminReportsPage /></AdminGuard>,
  },
  {
    path: "/admin/publicities",
    element: <AdminGuard><AdminPublicitiesPage /></AdminGuard>,
  },
  {
    path: "/admin/disputes",
    element: <AdminGuard><AdminDisputesPage /></AdminGuard>,
  },
  {
    path: "/admin/settings",
    element: <AdminGuard><AdminSettingsPage /></AdminGuard>,
  },
  {
    path: "/admin/notifications",
    element: <AdminGuard><AdminNotificationsPage /></AdminGuard>,
  },
  {
    path: "/merchant/login",
    element: <MerchantLoginPage />,
  },
  {
    path: "/merchant",
    element: <MerchantGuard><MerchantDashboard /></MerchantGuard>,
  },
  {
    path: "/merchant/products",
    element: <MerchantGuard><MerchantProductsPage /></MerchantGuard>,
  },
  {
    path: "/merchant/orders",
    element: <MerchantGuard><MerchantOrdersPage /></MerchantGuard>,
  },
  {
    path: "/merchant/bnpl",
    element: <MerchantGuard><MerchantBnplPage /></MerchantGuard>,
  },
  {
    path: "/merchant/analytics",
    element: <MerchantGuard><MerchantAnalyticsPage /></MerchantGuard>,
  },
  {
    path: "/merchant/settings",
    element: <MerchantGuard><MerchantSettingsPage /></MerchantGuard>,
  },
  {
    path: "*",
    element: <NotFound />,
  },
];

export default routes;