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
import { Terminal, ChevronDown, ChevronUp } from "lucide-react"
import { useEffect, useState } from "react";
import RootlessFrame from "./RootlessFrame";
import { pl } from "date-fns/locale";

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
  const [error, setError] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [reportData, setReportData] = useState<ReportType | null>(null);
  const [jellyfinData, setJellyfinData] = useState<any>(null);
  const [credentials, setCredentials] = useState({
    serverUrl: '',
    userId: '',
    token: ''
  });

  // State for expand/collapse functionality
  const [expandedSections, setExpandedSections] = useState({
    mostListened: false,
    topArtists: false,
    mostSkipped: false
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

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
      const mostPlayedItems = await (async () => {
        const query = `
          SELECT ItemId, ItemName, COUNT(*) as PlayCount, SUM(PlayDuration) as TotalDuration  
          FROM PlaybackActivity  
          WHERE ItemType = 'Audio'  
          AND DateCreated BETWEEN '${fromDate}' AND '${toDate}'
          AND UserId="${credentials.userId}"
          GROUP BY ItemId, ItemName  
          ORDER BY PlayCount DESC  
          LIMIT 10
        `;

        const res = await fetch(`${credentials.serverUrl}/user_usage_stats/submit_custom_query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `MediaBrowser Token=${credentials.token}`,
          },
          body: JSON.stringify({
            CustomQueryString: query,
            ReplaceUserId: false
          }),
        });

        const result = await res.json();
        const stats = result?.results || [];

        const statsObj = stats.map(([id, name, playCount, totalDuration]) => ({
          id,
          name,
          playCount,
          totalDuration
        }));

        console.log('Most Played Stats:', statsObj);
        if (stats.length === 0) return { Items: [] };

        const itemIds = stats.map(item => item[0]);

        // Fetch item metadata
        const itemsRes = await fetchFromJellyfin(`/Items`, {
          Ids: itemIds.join(','),
          Fields: 'PlayCount,UserData,PrimaryImageAspectRatio,MediaSourceCount,BasicSyncInfo'
        });

        // Reattach play duration to metadata
        const itemsWithDuration = itemsRes.Items
          ?.filter(item => item.Type === 'Audio')
          .map(item => {
            const stat = statsObj.find(obj => obj.id === item.Id);
            return {
              ...item,
              playCountFromDB: stat?.playCount || 0,
              TotalPlaySeconds: stat?.TotalPlaySeconds ?? 0
            };
          }) || [];


        return { Items: itemsWithDuration };
      })();

      if (!mostPlayedItems) return null;

      const topPlayedArtists = await (async () => {
        const query = `SELECT   
          SUBSTR(ItemName, 1, INSTR(ItemName, ' - ') - 1) AS Artist,  
          COUNT(*) AS PlayCount,  
          SUM(PlayDuration) AS TotalDuration  
          FROM PlaybackActivity  
          WHERE ItemType = 'Audio'  
            AND UserId="${credentials.userId}"
            AND DateCreated BETWEEN '${fromDate}' AND '${toDate}'  
            AND INSTR(ItemName, ' - ') > 0  
          GROUP BY Artist  
          ORDER BY PlayCount DESC  
          LIMIT 10
  `;

        const res = await fetch(`${credentials.serverUrl}/user_usage_stats/submit_custom_query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `MediaBrowser Token=${credentials.token}`,
          },
          body: JSON.stringify({
            CustomQueryString: query,
            ReplaceUserId: false
          }),
        });

        const result = await res.json();
        const stats = result?.results || [];
        const statsObj = stats.map(([name, playCount, totalDuration]) => ({
          name,
          playCount,
          totalDuration
        }));

        console.log('Top Played Artists Stats:', statsObj);



        return statsObj;
      })();

      const fetchArtistByName = async (name: string) => {
        const url = new URL(`${credentials.serverUrl}/Artists/`);
        url.searchParams.append('searchTerm', name);
        url.searchParams.append('limit', '1');

        const res = await fetch(url.toString(), {
          headers: {
            Authorization: `MediaBrowser Token=${credentials.token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!res.ok) {
          console.error(`Failed to fetch artist for "${name}": ${res.statusText}`);
          return null;
        }

        const data = await res.json();
        return data.Items?.[0] ?? null;
      };


      const fetchTopArtistsWithThumbnails = async (
        topArtistStats: { name: string; playCount: number; totalDuration: number }[]
      ) => {
        const topArtists = await Promise.all(
          topArtistStats.map(async (artist) => {
            const artistData = await fetchArtistByName(artist.name.replaceAll('"', ""));

            return {
              name: artist.name,
              plays: artist.playCount,
              totalDuration: artist.totalDuration,
              id: artistData?.Id ?? null,
              thumbnail: artistData?.ImageTags?.Primary
                ? `/Items/${artistData.Id}/Images/Primary?maxHeight=80`
                : null,
            };
          })
        );

        return topArtists;
      };

      const enrichedArtists = await fetchTopArtistsWithThumbnails(topPlayedArtists);


      async function fetchMostSkippedSongs(fromDate: string, toDate: string) {
        const query = `
            SELECT ItemName,  
                  ItemId,  
                  COUNT(*) as play_count,  
                  AVG(PlayDuration) as avg_duration_seconds,  
                  COUNT(CASE WHEN PlayDuration < 30 THEN 1 END) as skip_count,  
                  ROUND((COUNT(CASE WHEN PlayDuration < 30 THEN 1 END) * 100.0 / COUNT(*)), 2) as skip_percentage  
            FROM PlaybackActivity   
            WHERE ItemType = 'Audio'  
            AND UserId="${credentials.userId}"
              AND DateCreated BETWEEN '${fromDate}' AND '${toDate}'  
            GROUP BY ItemName, ItemId  
            HAVING play_count > 1  
            ORDER BY skip_percentage DESC, avg_duration_seconds ASC  
            LIMIT 50
          `;

        const res = await fetch(`${credentials.serverUrl}/user_usage_stats/submit_custom_query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `MediaBrowser Token=${credentials.token}`,
          },
          body: JSON.stringify({
            CustomQueryString: query,
            ReplaceUserId: false,
          }),
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch skip stats: ${res.statusText}`);
        }

        const result = await res.json();
        const stats = result?.results || [];

        // Map results to objects with named properties
        const skippedSongs = stats.map(
          ([itemName, itemId, playCount, avgDuration, skipCount, skipPercentage]) => ({
            itemName,
            itemId,
            playCount,
            avgDurationSeconds: avgDuration,
            skipCount,
            skipPercentage,
          })
        );

        return skippedSongs;
      }

      const mostSkipped = await fetchMostSkippedSongs(fromDate, toDate);
      console.log('Most Skipped Songs:', mostSkipped);

      const mostListened = mostPlayedItems.Items?.map((item: any, index: number) => ({
        rank: index + 1,
        title: item.Name,
        artist: item.Artists?.join(', ') || item.AlbumArtist || 'Unknown Artist',
        album: item.Album || 'Unknown Album',
        plays: item.UserData?.PlayCount || 0,
        totalPlayTime: item.TotalPlaySeconds || 0,
        playCountFromDB: item.playCountFromDB || 0,
        id: item.Id
      })) || [];

      return {
        mostListened,
        mostSkipped,
        topArtists: enrichedArtists,
        //topAlbums: topAlbumsList
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
        const id = params.get('id');

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

  const renderExpandableList = (
    items: any[],
    sectionKey: keyof typeof expandedSections,
    renderItem: (item: any, index: number) => React.ReactNode
  ) => {
    const isExpanded = expandedSections[sectionKey];
    const displayItems = isExpanded ? items : items.slice(0, 5);
    const hasMore = items.length > 5;

    return (
      <div className="space-y-3">
        {displayItems.map((item, index) => renderItem(item, index))}
        {hasMore && (
          <button
            onClick={() => toggleSection(sectionKey)}
            className="flex items-center gap-2 w-full p-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Show {items.length - 5} more
              </>
            )}
          </button>
        )}
      </div>
    );
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
        <TabsContent value="mostPlayed" className="space-y-2">
          <Card>
            <CardHeader>
              <CardTitle>Songs</CardTitle>
              <CardDescription>
                These are your top 10 most played songs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {jellyfinData.mostListened?.length > 0 ? (
                renderExpandableList(
                  jellyfinData.mostListened,
                  'mostListened',
                  (song: any) => (
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
                      <span className="text-sm font-medium flex-shrink-0">{song.playCountFromDB} plays</span>
                    </div>
                  )
                )
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
          <Card>
            <CardHeader>
              <CardTitle>Artists</CardTitle>
              <CardDescription>
                These are your top 10 most played artists.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {jellyfinData.topArtists?.length > 0 ? (
                renderExpandableList(
                  jellyfinData.topArtists,
                  'topArtists',
                  (artist: any) => (
                    <div key={artist.id} className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                        <img
                          src={`${credentials.serverUrl}${artist.thumbnail || `/Items/${artist.id}/Images/Primary?maxHeight=80`}`}
                          alt={artist.name}
                          className="w-12 h-12 object-cover rounded-full"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{artist.name}</p>
                      </div>
                      <span className="text-sm font-medium flex-shrink-0">{artist.plays} plays</span>
                    </div>
                  )
                )
              ) : (
                <Alert variant="default">
                  <Terminal className="h-4 w-4" />
                  <AlertTitle>No Data</AlertTitle>
                  <AlertDescription>
                    No played artists found for this time period.
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
                renderExpandableList(
                  jellyfinData.mostSkipped,
                  'mostSkipped',
                  (song: any) => (
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
                  )
                )
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