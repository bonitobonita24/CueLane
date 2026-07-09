// Wave 7.7c-T4 — Media admin tab. Two video source modes (Playlist / YouTube LIVE, PRODUCT.md
// §"Big Display Screen"): Playlist mode manages a PlaylistEntry list (YouTube links + locally
// uploaded files, tier-capped) via the `media` router; LIVE mode is a single `liveStreamUrl`
// persisted through `tenantAdmin.updateSettings` (JSON RMW on Tenant.settings — same pattern as
// theme-client.tsx), plus a Premium-only Tenant Ads section (`tenantAd` router) that only applies
// while in LIVE mode. Vanilla tRPC-proxy client (no react-query provider in this app, matching
// every other admin page) for everything EXCEPT the large-file upload, which bypasses tRPC
// entirely via a raw `XMLHttpRequest` POST to the T3 Route Handler (upload progress needs XHR —
// `fetch` has no upload-progress event).
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';
import { createClient } from '@/lib/trpc';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Progress,
} from '@cuelane/ui';
import { MediaType, AdType, VideoMode, TenantTier, MEDIA_LIMITS } from '@cuelane/shared';
import { DataTable } from '../_components/DataTable';
import { UsageMeter } from '../_components/UsageMeter';
import { extractYoutubeVideoId, moveItem } from './_lib/youtube';

const client = createClient('/api/trpc');

type PlaylistRow = { id: string; type: MediaType; title: string; videoId: string | null; fileName: string; sortOrder: number };
type TenantAdRow = { id: string; type: AdType; title: string; videoId: string | null; sortOrder: number };

export function MediaClient() {
  const params = useParams<{ tenant: string }>();
  const tenantSlug = params.tenant;

  const [tier, setTier] = useState<TenantTier | null>(null);
  const [videoMode, setVideoMode] = useState<VideoMode>(VideoMode.Playlist);
  const [liveStreamUrl, setLiveStreamUrl] = useState('');
  const [entries, setEntries] = useState<PlaylistRow[]>([]);
  const [ads, setAds] = useState<TenantAdRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingMode, setSavingMode] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<PlaylistRow | null>(null);
  const [deletingAd, setDeletingAd] = useState<TenantAdRow | null>(null);

  const [ytDialogOpen, setYtDialogOpen] = useState(false);
  const [ytTitle, setYtTitle] = useState('');
  const [ytUrl, setYtUrl] = useState('');
  const [ytIsLive, setYtIsLive] = useState(false);
  const [ytSubmitting, setYtSubmitting] = useState(false);

  const [adDialogOpen, setAdDialogOpen] = useState(false);
  const [adTitle, setAdTitle] = useState('');
  const [adUrl, setAdUrl] = useState('');
  const [adSubmitting, setAdSubmitting] = useState(false);

  const [uploadTitle, setUploadTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const isPremium = tier === TenantTier.Premium;
  const limits = MEDIA_LIMITS[isPremium ? 'premium' : 'free'];
  const uploadedCount = entries.filter((e) => e.type === MediaType.Local).length;

  const refresh = useCallback(async () => {
    const [settings, list] = await Promise.all([client.tenantAdmin.getSettings.query(), client.media.list.query()]);
    setTier(settings.tier as TenantTier);
    const s = (settings.settings ?? {}) as { videoMode?: VideoMode; liveStreamUrl?: string };
    setVideoMode(s.videoMode ?? VideoMode.Playlist);
    setLiveStreamUrl(s.liveStreamUrl ?? '');
    setEntries(list as PlaylistRow[]);
    // Cast: `settings.tier` comes back through tRPC typed against Prisma's generated TenantTier
    // (a distinct nominal type from `@cuelane/shared`'s TenantTier) — same eslint
    // no-unsafe-enum-comparison fix as the server-side routers.
    if ((settings.tier as TenantTier) === TenantTier.Premium) {
      setAds((await client.tenantAd.list.query()) as TenantAdRow[]);
    } else {
      setAds([]);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh()
      .catch(() => toast.error('Failed to load media settings.'))
      .finally(() => setLoading(false));
  }, [refresh]);

  const saveVideoMode = async (mode: VideoMode, nextLiveStreamUrl?: string) => {
    setSavingMode(true);
    try {
      await client.tenantAdmin.updateSettings.mutate({
        settings: { videoMode: mode, ...(nextLiveStreamUrl !== undefined ? { liveStreamUrl: nextLiveStreamUrl } : {}) },
      });
      setVideoMode(mode);
      toast.success('Video mode saved.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save video mode.');
    } finally {
      setSavingMode(false);
    }
  };

  const handleAddYoutube = async () => {
    const videoId = extractYoutubeVideoId(ytUrl);
    if (videoId == null) {
      toast.error('Enter a valid YouTube URL or 11-character video ID.');
      return;
    }
    if (ytTitle.trim() === '') {
      toast.error('Title is required.');
      return;
    }
    setYtSubmitting(true);
    try {
      await client.media.createYoutube.mutate({ type: MediaType.YouTube, title: ytTitle.trim(), videoId, isLive: ytIsLive });
      toast.success('Video added to playlist.');
      setYtDialogOpen(false);
      setYtTitle('');
      setYtUrl('');
      setYtIsLive(false);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add video.');
    } finally {
      setYtSubmitting(false);
    }
  };

  const handleAddAd = async () => {
    const videoId = extractYoutubeVideoId(adUrl);
    if (videoId == null) {
      toast.error('Enter a valid YouTube URL or 11-character video ID.');
      return;
    }
    if (adTitle.trim() === '') {
      toast.error('Title is required.');
      return;
    }
    setAdSubmitting(true);
    try {
      await client.tenantAd.create.mutate({ type: AdType.YouTube, title: adTitle.trim(), videoId });
      toast.success('Tenant ad added.');
      setAdDialogOpen(false);
      setAdTitle('');
      setAdUrl('');
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add tenant ad.');
    } finally {
      setAdSubmitting(false);
    }
  };

  const handleReorder = async (index: number, direction: 'up' | 'down') => {
    const ids = entries.map((e) => e.id);
    const nextIds = moveItem(ids, index, direction);
    if (nextIds.join() === ids.join()) return;
    const byId = new Map(entries.map((e) => [e.id, e]));
    setEntries(nextIds.map((id) => byId.get(id)!));
    try {
      await client.media.reorder.mutate({ orderedIds: nextIds });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to reorder.');
      await refresh();
    }
  };

  const handleReorderAd = async (index: number, direction: 'up' | 'down') => {
    const ids = ads.map((a) => a.id);
    const nextIds = moveItem(ids, index, direction);
    if (nextIds.join() === ids.join()) return;
    const byId = new Map(ads.map((a) => [a.id, a]));
    setAds(nextIds.map((id) => byId.get(id)!));
    try {
      await client.tenantAd.reorder.mutate({ orderedIds: nextIds });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to reorder.');
      await refresh();
    }
  };

  const handleDelete = async () => {
    if (deleting == null) return;
    setBusyId(deleting.id);
    try {
      await client.media.delete.mutate({ id: deleting.id });
      toast.success('Removed from playlist.');
      setDeleting(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteAd = async () => {
    if (deletingAd == null) return;
    setBusyId(deletingAd.id);
    try {
      await client.tenantAd.delete.mutate({ id: deletingAd.id });
      toast.success('Tenant ad removed.');
      setDeletingAd(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove.');
    } finally {
      setBusyId(null);
    }
  };

  const handleUpload = () => {
    const file = fileInputRef.current?.files?.[0];
    if (file == null) {
      toast.error('Choose a file to upload.');
      return;
    }
    if (uploadTitle.trim() === '') {
      toast.error('Title is required.');
      return;
    }
    if (uploadedCount >= limits.maxUploadedFiles) {
      toast.error(`Uploaded file limit reached (${limits.maxUploadedFiles} max for this tier).`);
      return;
    }
    if (entries.length >= limits.maxPlaylistItems) {
      toast.error(`Playlist limit reached (${limits.maxPlaylistItems} items max for this tier).`);
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', uploadTitle.trim());

    setUploadProgress(0);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/tenants/${tenantSlug}/media/upload`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) setUploadProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      setUploadProgress(null);
      if (xhr.status >= 200 && xhr.status < 300) {
        toast.success('File uploaded.');
        setUploadTitle('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        void refresh();
      } else {
        let message = 'Upload failed.';
        try {
          message = (JSON.parse(xhr.responseText) as { error?: string }).error ?? message;
        } catch {
          // non-JSON error body — keep default message
        }
        toast.error(message);
      }
    };
    xhr.onerror = () => {
      setUploadProgress(null);
      toast.error('Upload failed — network error.');
    };
    xhr.send(formData);
  };

  const columns: ColumnDef<PlaylistRow>[] = [
    {
      id: 'position',
      header: '#',
      cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{row.index + 1}</span>,
    },
    {
      id: 'type',
      header: 'Source',
      cell: ({ row }) => (
        <Badge variant={row.original.type === MediaType.YouTube ? 'secondary' : 'outline'}>
          {row.original.type === MediaType.YouTube ? 'YouTube' : 'Local'}
        </Badge>
      ),
    },
    { accessorKey: 'title', header: 'Title' },
    {
      id: 'source',
      header: 'Reference',
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.type === MediaType.YouTube ? row.original.videoId : row.original.fileName}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" disabled={row.index === 0} onClick={() => void handleReorder(row.index, 'up')}>
            ↑
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={row.index === entries.length - 1}
            onClick={() => void handleReorder(row.index, 'down')}
          >
            ↓
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            disabled={busyId === row.original.id}
            onClick={() => setDeleting(row.original)}
          >
            Remove
          </Button>
        </div>
      ),
    },
  ];

  const adColumns: ColumnDef<TenantAdRow>[] = [
    {
      id: 'position',
      header: '#',
      cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{row.index + 1}</span>,
    },
    { accessorKey: 'title', header: 'Title' },
    {
      id: 'source',
      header: 'Reference',
      cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.videoId}</span>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" disabled={row.index === 0} onClick={() => void handleReorderAd(row.index, 'up')}>
            ↑
          </Button>
          <Button variant="ghost" size="sm" disabled={row.index === ads.length - 1} onClick={() => void handleReorderAd(row.index, 'down')}>
            ↓
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            disabled={busyId === row.original.id}
            onClick={() => setDeletingAd(row.original)}
          >
            Remove
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Big Display video source</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={videoMode === VideoMode.Playlist ? 'default' : 'outline'}
              disabled={savingMode}
              onClick={() => void saveVideoMode(VideoMode.Playlist)}
            >
              Playlist
            </Button>
            <Button
              variant={videoMode === VideoMode.Live ? 'default' : 'outline'}
              disabled={savingMode}
              onClick={() => void saveVideoMode(VideoMode.Live)}
            >
              YouTube LIVE
            </Button>
          </div>

          {videoMode === VideoMode.Live && (
            <div className="flex max-w-lg items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="live-stream-url">Live stream URL</Label>
                <Input
                  id="live-stream-url"
                  placeholder="https://www.youtube.com/live/..."
                  value={liveStreamUrl}
                  onChange={(e) => setLiveStreamUrl(e.target.value)}
                />
              </div>
              <Button disabled={savingMode} onClick={() => void saveVideoMode(VideoMode.Live, liveStreamUrl.trim())}>
                Save
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {videoMode === VideoMode.Playlist && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle>Playlist</CardTitle>
            <Button onClick={() => setYtDialogOpen(true)} disabled={entries.length >= limits.maxPlaylistItems}>
              Add YouTube Video
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <UsageMeter label="Playlist items" count={entries.length} limit={limits.maxPlaylistItems} />
              <UsageMeter label="Uploaded files" count={uploadedCount} limit={limits.maxUploadedFiles} />
            </div>

            <div className="flex flex-col gap-2 rounded-md border p-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="upload-title">Title</Label>
                <Input id="upload-title" value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder="e.g. Branch promo" />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="upload-file">Video file (MP4, AVI, MKV, WebM, MOV)</Label>
                <Input id="upload-file" type="file" ref={fileInputRef} accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska" />
              </div>
              <Button onClick={handleUpload} disabled={uploadProgress != null}>
                Upload
              </Button>
            </div>
            {uploadProgress != null && <Progress value={uploadProgress} aria-label={`Upload progress: ${uploadProgress}%`} className="h-2" />}

            <DataTable columns={columns} data={entries} emptyMessage={loading ? 'Loading…' : 'No videos in the playlist yet.'} />
          </CardContent>
        </Card>
      )}

      {videoMode === VideoMode.Live && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle>Tenant Ads (Premium — LIVE mode only)</CardTitle>
            {isPremium && <Button onClick={() => setAdDialogOpen(true)}>Add Ad</Button>}
          </CardHeader>
          <CardContent>
            {isPremium ? (
              <DataTable columns={adColumns} data={ads} emptyMessage={loading ? 'Loading…' : 'No tenant ads yet.'} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Custom tenant ads interrupt your LIVE stream every 5 minutes instead of CueLane's system ads. Upgrade to
                Premium (Tenant tab) to add your own.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={ytDialogOpen} onOpenChange={setYtDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add YouTube Video</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="yt-title">Title</Label>
              <Input id="yt-title" value={ytTitle} onChange={(e) => setYtTitle(e.target.value)} placeholder="e.g. Welcome video" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="yt-url">YouTube URL or video ID</Label>
              <Input id="yt-url" value={ytUrl} onChange={(e) => setYtUrl(e.target.value)} placeholder="https://youtu.be/..." />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="yt-live" checked={ytIsLive} onCheckedChange={(v) => setYtIsLive(v === true)} />
              <Label htmlFor="yt-live">This is a live stream</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setYtDialogOpen(false)} disabled={ytSubmitting}>
              Cancel
            </Button>
            <Button onClick={() => void handleAddYoutube()} disabled={ytSubmitting}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={adDialogOpen} onOpenChange={setAdDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Tenant Ad</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ad-title">Title</Label>
              <Input id="ad-title" value={adTitle} onChange={(e) => setAdTitle(e.target.value)} placeholder="e.g. Promo ad" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ad-url">YouTube URL or video ID</Label>
              <Input id="ad-url" value={adUrl} onChange={(e) => setAdUrl(e.target.value)} placeholder="https://youtu.be/..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdDialogOpen(false)} disabled={adSubmitting}>
              Cancel
            </Button>
            <Button onClick={() => void handleAddAd()} disabled={adSubmitting}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleting != null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove "{deleting?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyId != null}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()} disabled={busyId != null}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deletingAd != null} onOpenChange={(open) => !open && setDeletingAd(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove "{deletingAd?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyId != null}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDeleteAd()} disabled={busyId != null}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
