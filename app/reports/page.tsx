
import Frame from "@/components/Frame";
import ReportsList from "@/components/ReportsList";
import { Button } from "@/components/ui/button";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";


export default function ReportsViewPage() {
    //get reports from local storage


    return (
        <Frame title="Your Reports">
            <Button asChild><Link href="/new-report"><FontAwesomeIcon icon={faPlus} />New Report</Link></Button>
            <ReportsList />
        </Frame>
    )
}