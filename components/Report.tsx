'use client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useEffect, useState } from "react";
import RootlessFrame from "./RootlessFrame";

type ReportType = {
  id: string;
  title: string;
  timespan: {
    from: string;
    to: string;
  };
};

export default function ReportComponent() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState([]);
  const [error, setError] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [reportData, setReportData] = useState<ReportType | null>(null);
  const [jellyfinData, setJellyfinData] = useState<any>(null);
  const [credentials, setCredentials] = useState({
    serverUrl: '',
    userId: '',
    token: ''
  });

  // This useEffect is redundant - the URL parsing is handled in loadReportData

  useEffect(() => {
    const serverUrl = localStorage.getItem("jellyfin_server_url") || '';
    const userId = localStorage.getItem("jellyfin_user_id") || '';
    const token = localStorage.getItem("jellyfin_token") || '';

    setCredentials({
      serverUrl,
      userId,
      token
    });
  }, []);

  const fetchFromJellyfin = async (endpoint: string, params = {}) => {
    const queryParams = new URLSearchParams(params).toString();
    const url = `${credentials.serverUrl}${endpoint}${queryParams ? '?' + queryParams : ''}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `MediaBrowser Token="${credentials.token}"`,
        'Content-Type': 'application/json',
        'X-Emby-Authorization': `MediaBrowser Client="Jellywind", Device="WebClient", DeviceId="web-123", Version="1.0.0", Token="${credentials.token}"`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Instead of throwing, set error state
      setError(`Jellyfin API error: ${response.status} - ${errorText}`);
      setLoading(false);
      return null;
    }

    return await response.json();
  };

  // Fetch music statistics from Jellyfin
  const fetchJellyfinMusicData = async (fromDate: string, toDate: string) => {
    try {
      // Get most played items (songs/tracks)
      const mostPlayedItems = await fetchFromJellyfin(`/Users/${credentials.userId}/Items`, {
        IncludeItemTypes: 'Audio',
        Recursive: true,
        SortBy: 'PlayCount',
        SortOrder: 'Descending',
        Limit: 10,
        Fields: 'PlayCount,UserData,PrimaryImageAspectRatio,MediaSourceCount,BasicSyncInfo'
      });

      if (!mostPlayedItems) return null; // Error already set in fetchFromJellyfin

      // Get recently played items to analyze skipping patterns
      const recentlyPlayed = await fetchFromJellyfin(`/Users/${credentials.userId}/Items`, {
        IncludeItemTypes: 'Audio',
        Recursive: true,
        SortBy: 'DatePlayed',
        SortOrder: 'Descending',
        Limit: 50,
        Fields: 'PlayCount,UserData,DatePlayed,RunTimeTicks'
      });

      if (!recentlyPlayed) return null;

      // Get artists statistics
      const topArtists = await fetchFromJellyfin(`/Users/${credentials.userId}/Items`, {
        IncludeItemTypes: 'MusicArtist',
        Recursive: true,
        SortBy: 'PlayCount',
        SortOrder: 'Descending',
        Limit: 10,
        Fields: 'PlayCount'
      });

      if (!topArtists) return null;

      // Get albums statistics
      const topAlbums = await fetchFromJellyfin(`/Users/${credentials.userId}/Items`, {
        IncludeItemTypes: 'MusicAlbum',
        Recursive: true,
        SortBy: 'PlayCount',
        SortOrder: 'Descending',
        Limit: 10,
        Fields: 'PlayCount,AlbumArtist'
      });

      if (!topAlbums) return null;
      
      // Process the data
      const mostListened = mostPlayedItems.Items?.map((item: any, index: number) => ({
        rank: index + 1,
        title: item.Name,
        artist: item.Artists?.join(', ') || item.AlbumArtist || 'Unknown Artist',
        album: item.Album || 'Unknown Album',
        plays: item.UserData?.PlayCount || 0,
        id: item.Id
      })) || [];

      // ????
      const potentialSkipped = recentlyPlayed.Items?.filter((item: any) => 
        (item.UserData?.PlayCount || 0) < 3 && item.UserData?.LastPlayedDate
      ).map((item: any, index: number) => ({
        rank: index + 1,
        title: item.Name,
        artist: item.Artists?.join(', ') || item.AlbumArtist || 'Unknown Artist',
        album: item.Album || 'Unknown Album',
        skips: Math.max(1, 5 - (item.UserData?.PlayCount || 0)), // Estimated skip count
        id: item.Id
      })).slice(0, 10) || [];

      const topArtistsList = topArtists.Items?.map((item: any, index: number) => ({
        rank: index + 1,
        name: item.Name,
        plays: item.UserData?.PlayCount || 0,
        id: item.Id
      })) || [];

      const topAlbumsList = topAlbums.Items?.map((item: any, index: number) => ({
        rank: index + 1,
        title: item.Name,
        artist: item.AlbumArtist || item.Artists?.join(', ') || 'Unknown Artist',
        plays: item.UserData?.PlayCount || 0,
        id: item.Id
      })) || [];

      return {
        mostListened,
        mostSkipped: potentialSkipped,
        topArtists: topArtistsList,
        topAlbums: topAlbumsList
      };

    } catch (error: any) {
      console.error('Error fetching Jellyfin data:', error);
      setError(`Error fetching Jellyfin data: ${error.message}`);
      setLoading(false);
      return null;
    }
  };

  useEffect(() => {
    const loadReportData = async () => {
      try {
        // Get reports from localStorage
        const storedReports = JSON.parse(localStorage.getItem('reports') || '[]');

        // Get reportId from URL (using 'id' parameter)
        const url = window.location.href;
        const urlObj = new URL(url);
        const params = new URLSearchParams(urlObj.search);
        const id = params.get('id'); // Changed from 'reportId' to 'id' to match the first useEffect
        
        if (!id) {
          setError('No report ID found in the URL');
          setLoading(false);
          return;
        }

        setReportId(id);

        // Find the specific report
        const foundReport = storedReports.find((report: ReportType) => report.id === id);

        if (!foundReport) {
          setError('Report not found');
          setLoading(false);
          return;
        }

        setReportData(foundReport);

        // Fetch real data from Jellyfin
        const musicData = await fetchJellyfinMusicData(
          foundReport.timespan.from,
          foundReport.timespan.to
        );

        if (musicData) {
          setJellyfinData(musicData);
        }
        setLoading(false);

      } catch (err: any) {
        setError(`Error loading report data: ${err.message}`);
        setLoading(false);
        console.error('Error loading report:', err);
      }
    };

    if (credentials.serverUrl && credentials.userId && credentials.token) {
      loadReportData();
    }
  }, [credentials]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">Fetching your music data from Jellyfin...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="container mx-auto p-4">
        <Alert variant="default">
          <AlertTitle>No Data</AlertTitle>
          <AlertDescription>
            No report data available. Please check if the report ID is correct.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!jellyfinData) {
    return (
      <div className="container mx-auto p-4">
        <Alert variant="default">
          <AlertTitle>Loading Data</AlertTitle>
          <AlertDescription>
            Still fetching data from Jellyfin server. Please wait...
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <RootlessFrame title={reportData.title} subheading={`${formatDate(reportData.timespan.from)} - ${formatDate(reportData.timespan.to)}`}>
      <Tabs defaultValue="mostPlayed">
        <TabsList>
          <TabsTrigger value="mostPlayed">Most played</TabsTrigger>
          <TabsTrigger value="mostSkipped">Most skipped</TabsTrigger>
        </TabsList>
        <TabsContent value="mostPlayed">
          <Card>
            <CardHeader>
              <CardTitle>Songs</CardTitle>
              <CardDescription>
                These are your top 10 most played songs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {jellyfinData.mostListened?.length > 0 ? (
                <div className="space-y-3">
                  {jellyfinData.mostListened.map((song: any) => (
                    <div key={song.id} className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-md overflow-hidden bg-gray-200 flex-shrink-0">
                        <img
                          src={`${credentials.serverUrl}/Items/${song.id}/Images/Primary?height=96&width=96&quality=90`}
                          alt={`${song.title} thumbnail`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Fallback to a default music icon if image fails to load
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling.style.display = 'flex';
                          }}
                        />
                        <div className="w-full h-full bg-gray-300 items-center justify-center hidden">
                          <svg className="w-6 h-6 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{song.title}</p>
                        <p className="text-sm text-muted-foreground truncate">{song.artist}</p>
                      </div>
                      <span className="text-sm font-medium flex-shrink-0">{song.plays} plays</span>
                    </div>
                  ))}
                </div>
              ) : (
                <Alert variant="default">
                  <Terminal className="h-4 w-4" />
                  <AlertTitle>No Data</AlertTitle>
                  <AlertDescription>
                    No played songs found for this time period.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="mostSkipped">
          <Card>
            <CardHeader>
              <CardTitle>Most Skipped Songs</CardTitle>
              <CardDescription>
                Songs you tend to skip most often.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {jellyfinData.mostSkipped?.length > 0 ? (
                <div className="space-y-3">
                  {jellyfinData.mostSkipped.map((song: any) => (
                    <div key={song.id} className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-md overflow-hidden bg-gray-200 flex-shrink-0">
                        <img
                          src={`${credentials.serverUrl}/Items/${song.id}/Images/Primary?height=96&width=96&quality=90`}
                          alt={`${song.title} thumbnail`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Fallback to a default music icon if image fails to load
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling.style.display = 'flex';
                          }}
                        />
                        <div className="w-full h-full bg-gray-300 items-center justify-center hidden">
                          <svg className="w-6 h-6 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{song.title}</p>
                        <p className="text-sm text-muted-foreground truncate">{song.artist}</p>
                      </div>
                      <span className="text-sm font-medium flex-shrink-0">{song.skips} skips</span>
                    </div>
                  ))}
                </div>
              ) : (
                <Alert variant="default">
                  <Terminal className="h-4 w-4" />
                  <AlertTitle>No Data</AlertTitle>
                  <AlertDescription>
                    No skipped songs found for this time period.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </RootlessFrame>
  );
}