import OnboardingTour from '@/components/Onboarding'

export default function PatientLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
            <OnboardingTour />
        </>
    )
}
