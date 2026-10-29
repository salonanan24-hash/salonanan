import { Route, Routes } from 'react-router-dom';
import { AdminShell } from '@/admin/AdminShell';
import { BrandsPage } from '@/admin/BrandsPage';
import { CategoriesPage } from '@/admin/CategoriesPage';
import { CustomersPage, DashboardPage, MessagesPage, OrdersPage } from '@/admin/DashboardPage';
import { ReportsPage } from '@/admin/ReportsPage';
import { CouponsPage, SettingsPage } from '@/admin/MorePages';
import { PackagesPage as AdminPackagesPage } from '@/admin/PackagesPage';
import { ProductsPage } from '@/admin/ProductsPage';
import { StoreLayout } from '@/components/layout/StoreLayout';
import { AccountLayout } from '@/components/account/AccountLayout';
import { AccountPage } from '@/pages/AccountPage';
import { AccountOrderPage } from '@/pages/AccountOrderPage';
import { AccountOrdersPage } from '@/pages/AccountOrdersPage';
import { AccountDashboardPage, AccountReviewsPage } from '@/pages/AccountSections';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { CartPage } from '@/pages/CartPage';
import { BrandPage } from '@/pages/BrandPage';
import { CategoryPage } from '@/pages/CategoryPage';
import { CheckoutPage } from '@/pages/CheckoutPage';
import { ComparePage } from '@/pages/ComparePage';
import { FavoritesPage } from '@/pages/FavoritesPage';
import { ContactPage, PrivacyPage, TermsPage } from '@/pages/LegalPage';
import { HomePage } from '@/pages/HomePage';
import { PackagesPage } from '@/pages/PackagesPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ProductPage } from '@/pages/ProductPage';

export function App() {
  return (
    <Routes>
      <Route path="admin" element={<AdminShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="packages" element={<AdminPackagesPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="brands" element={<BrandsPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="coupons" element={<CouponsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route element={<StoreLayout />}>
        <Route index element={<HomePage />} />
        <Route path="packages" element={<PackagesPage />} />
        <Route path="category/:slug" element={<CategoryPage />} />
        <Route path="brands/:slug" element={<BrandPage />} />
        <Route path="product/:slug/:sku?" element={<ProductPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="terms" element={<TermsPage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route path="account" element={<AccountLayout />}>
          <Route index element={<AccountPage />} />
          <Route path="dashboard" element={<AccountDashboardPage />} />
          <Route path="orders" element={<AccountOrdersPage />} />
          <Route path="orders/:orderId" element={<AccountOrderPage />} />
          <Route path="reviews" element={<AccountReviewsPage />} />
        </Route>
        <Route path="favorites" element={<FavoritesPage />} />
        <Route path="compare" element={<ComparePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
