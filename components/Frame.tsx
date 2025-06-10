import RootLayout from "@/app/layout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


interface Props {
    title: string;
    subheading?: string;
    children?: React.ReactNode;
}

export default function Frame({
    title,
    subheading,
    children
}: Props) {
    return (
            <RootLayout>
                <div className="p-4 max-w-xl mx-auto flex flex-col gap-3">
                    <h1 className="text-2xl font-bold">{title}</h1>
                    <p className="mb-4">{subheading}</p>
                    {children}
                </div>
            </RootLayout>
    );
}
