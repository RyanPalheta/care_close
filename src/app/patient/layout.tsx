import OnboardingTour from '@/components/Onboarding'
import NotificationGuard from '@/components/NotificationGuard'

export default function PatientLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
            <OnboardingTour />
            <NotificationGuard />
        </>
    )
}
