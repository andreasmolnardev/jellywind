import  Link from "next/link";
import { Card } from "./ui/card";

interface ReportCardProps {
    id: string;
    title: string;
    timespan?: string;
    additionalSourcesUsed?: string[];
    dateGenerated?: string;
    children?: React.ReactNode;
}

export default function ReportCardComponent({
    id,
    title,
    timespan,
    additionalSourcesUsed,
    dateGenerated,
    children,
}: ReportCardProps) {
    return (
        <Link href={`/report?id=${id}`} className="no-underline">
            <Card className="flex items-center justify-center">
                <h2>{title}</h2>
                <p>
                    {timespan && <>Timespan: {timespan}</>} {additionalSourcesUsed && additionalSourcesUsed.length > 0 && (<>Additional Sources Used: {additionalSourcesUsed.join(", ")}</>
                    )} {dateGenerated && <> {dateGenerated}</>}
                    {children}
                </p>

            </Card>
        </Link>
    );
}
