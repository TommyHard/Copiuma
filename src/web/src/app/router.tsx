import { createBrowserRouter, Outlet } from 'react-router-dom';
import { AppLayout } from '@/layout/AppLayout';
import { AuthLayout } from '@/layout/AuthLayout';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { RequireVerified } from '@/features/auth/RequireVerified';
import { RequireRole } from '@/features/auth/RequireRole';
import { HomePage } from '@/pages/HomePage';
import { MePage } from '@/pages/MePage';
import { CatalogPage } from '@/pages/CatalogPage';
import { TrackPage } from '@/pages/TrackPage';
import { SearchPage } from '@/pages/SearchPage';
import { FavoritesPage } from '@/pages/FavoritesPage';
import { UploadPage } from '@/pages/UploadPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { VerifyEmailPage } from '@/pages/auth/VerifyEmailPage';
import { ResendVerificationPage } from '@/pages/auth/ResendVerificationPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { DeviceGrantPage } from '@/pages/auth/DeviceGrantPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export const router = createBrowserRouter([
    {
        path: '/auth',
        element: <AuthLayout />,
        children: [
            { path: 'login', element: <LoginPage /> },
            { path: 'register', element: <RegisterPage /> },
            { path: 'verify-email', element: <VerifyEmailPage /> },
            { path: 'resend-verification', element: <ResendVerificationPage /> },
            { path: 'forgot-password', element: <ForgotPasswordPage /> },
            { path: 'reset-password', element: <ResetPasswordPage /> },
            { path: 'device-grant', element: <DeviceGrantPage /> },
        ],
    },
    {
        path: '/',
        element: (
            <RequireAuth>
                <AppLayout />
            </RequireAuth>
        ),
        children: [
            { index: true, element: <HomePage /> },

            // ¬се приватные страницы внутри: guard RequireVerified прокидывает <Outlet/>
            // только если email подтверждЄн, иначе показывает заглушку
            {
                element: (
                    <RequireVerified>
                        <Outlet />
                    </RequireVerified>
                ),
                children: [
                    { path: 'catalog', element: <CatalogPage /> },
                    { path: 'tracks/:id', element: <TrackPage /> },
                    { path: 'search', element: <SearchPage /> },
                    { path: 'favorites', element: <FavoritesPage /> },
                    { path: 'me', element: <MePage /> },
                    {
                        path: 'upload',
                        element: (
                            <RequireRole atLeast="Artist">
                                <UploadPage />
                            </RequireRole>
                        ),
                    },
                ],
            },
        ],
    },
    { path: '*', element: <NotFoundPage /> },
]);