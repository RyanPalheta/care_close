import CaregiverOnboardingTour from '@/components/CaregiverOnboarding'
import NotificationGuard from '@/components/NotificationGuard'

export default function CaregiverLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
            <CaregiverOnboardingTour />
            <NotificationGuard />
        </>
    )
}
