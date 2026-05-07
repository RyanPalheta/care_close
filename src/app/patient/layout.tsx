import OnboardingTour from '@/components/Onboarding'
import InstallPrompt from '@/components/InstallPrompt'

export default function PatientLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
            <OnboardingTour />
            <InstallPrompt />
        </>
    )
}
