
import Center from "@/components/Center";
import Frame from "@/components/Frame";
import NewReportForm from "@/components/NewReportForm";

export default function CreateNewReportPage() {

  return (
    <Frame
      title="New Report"
      subheading="for Jellyfin"
    >
      <NewReportForm />
    </Frame>
  );
}
