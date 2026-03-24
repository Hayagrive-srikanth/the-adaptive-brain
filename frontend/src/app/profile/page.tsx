'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useProfileStore } from '@/stores/profileStore';
import AuthGuard from '@/components/auth/AuthGuard';
import { ProfileCard } from '@/components/profile/ProfileCard';
import { ProfilePromptEditor } from '@/components/profile/ProfilePromptEditor';
import { Spinner } from '@/components/ui/Loader';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ProfilePage() {
  const { user } = useAuthStore();
  const { profile, loading, fetchProfile } = useProfileStore();

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Your Learning Profile
          </h1>
          <p className="text-gray-500 mb-8">
            This is how we personalize your study experience
          </p>

          {loading && !profile ? (
            <Spinner />
          ) : profile ? (
            <>
              <ProfileCard profile={profile} userName={user?.name || 'Student'} />
              <div className="mt-8">
                <ProfilePromptEditor />
              </div>
            </>
          ) : (
            <p className="text-gray-500">No profile found. Complete onboarding first.</p>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
