import CaregiverOnboardingTour from '@/components/CaregiverOnboarding'

export default function CaregiverLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
            <CaregiverOnboardingTour />
        </>
    )
}
