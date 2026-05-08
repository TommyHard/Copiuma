import { createBrowserRouter, Outlet } from 'react-router-dom';
import { AppLayout } from '@/layout/AppLayout';
import { AuthLayout } from '@/layout/AuthLayout';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { RequireVerified } from '@/features/auth/RequireVerified';
import { RequireRole } from '@/features/auth/RequireRole';
import { HomePage } from '@/pages/HomePage';
import { CatalogPage } from '@/pages/CatalogPage';
import { TrackPage } from '@/pages/TrackPage';
import { SearchPage } from '@/pages/SearchPage';
import { FavoritesPage } from '@/pages/FavoritesPage';
import { OfflinePage } from '@/pages/OfflinePage';
import { UploadPage } from '@/pages/UploadPage';
import { ArtistPage } from '@/pages/ArtistPage';
import { AlbumPage } from '@/pages/AlbumPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { PlaylistsPage } from '@/pages/PlaylistsPage';
import { PlaylistPage } from '@/pages/PlaylistPage';
import { RoomsLandingPage } from '@/pages/RoomsLandingPage';
import { RoomPage } from '@/pages/RoomPage';
import { HistoryPage } from '@/pages/HistoryPage';
import { FriendsPage } from '@/pages/FriendsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { VerifyEmailPage } from '@/pages/auth/VerifyEmailPage';
import { ResendVerificationPage } from '@/pages/auth/ResendVerificationPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { DeviceGrantPage } from '@/pages/auth/DeviceGrantPage';
import { UserProfilePage } from '@/pages/UserProfilePage';
import { ArtistSettingsPage } from '@/pages/ArtistSettingsPage';
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
            {
                element: (
                    <RequireVerified>
                        <Outlet />
                    </RequireVerified>
                ),
                children: [
                    { path: 'catalog', element: <CatalogPage /> },
                    { path: 'tracks/:id', element: <TrackPage /> },
                    { path: 'artists/:id', element: <ArtistPage /> },
                    { path: 'albums/:id', element: <AlbumPage /> },
                    { path: 'search', element: <SearchPage /> },
                    { path: 'favorites', element: <FavoritesPage /> },
                    { path: 'offline', element: <OfflinePage /> },
                    { path: 'history', element: <HistoryPage /> },
                    { path: 'notifications', element: <NotificationsPage /> },
                    { path: 'playlists', element: <PlaylistsPage /> },
                    { path: 'playlists/:id', element: <PlaylistPage /> },
                    { path: 'rooms', element: <RoomsLandingPage /> },
                    { path: 'rooms/:id', element: <RoomPage /> },
                    { path: 'users/:id', element: <UserProfilePage /> },
                    { path: 'friends', element: <FriendsPage /> },
                    { path: 'settings', element: <SettingsPage /> },
                    { path: 'artist/settings', element: <ArtistSettingsPage /> },
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