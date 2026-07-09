// Wave 7.8-T3 — System Ads Manager. Global ads that interrupt every Free-tier Big Display every
// 5 minutes (docs/PRODUCT.md "System Ads Manager"). Add-YouTube dialog + upload-file dialog (via
// the Wave 7.8-T1 global upload Route Handler, /api/system-ads/upload — large files can't go
// through the tRPC httpBatchLink, same rationale as the tenant Media Manager upload route) +
// enabled toggle + up/down reorder + delete-with-confirm.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/trpc';
import { AdType } from '@cuelane/shared';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Skeleton,
  Switch,
} from '@cuelane/ui';
import { moveItem } from './_lib/reorder';
import { extractYoutubeVideoId } from './_lib/youtube';

interface SystemAdRow {
  id: string;
  type: 'youtube' | 'uploaded';
  title: string;
  videoId: string | null;
  storageKey: string | null;
  fileName: string;
  duration: number;
  enabled: boolean;
  sortOrder: number;
}

const client = createClient('/api/trpc');

export function SystemAdsClient() {
  const [ads, setAds] = useState<SystemAdRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [ytOpen, setYtOpen] = useState(false);
  const [ytTitle, setYtTitle] = useState('');
  const [ytUrl, setYtUrl] = useState('');
  const [ytDuration, setYtDuration] = useState(30);
  const [ytSubmitting, setYtSubmitting] = useState(false);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDuration, setUploadDuration] = useState(30);
  const [uploadSubmitting, setUploadSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const rows = await client.superAdmin.listSystemAds.query();
    setAds(rows);
  }, []);

  useEffect(() => {
    refresh()
      .catch(() => toast.error('Failed to load system ads.'))
      .finally(() => setLoading(false));
  }, [refresh]);

  const submitYoutube = useCallback(async () => {
    const videoId = extractYoutubeVideoId(ytUrl);
    if (videoId == null || ytTitle.trim() === '') {
      toast.error('Enter a title and a valid YouTube URL or video ID.');
      return;
    }
    setYtSubmitting(true);
    try {
      await client.superAdmin.createSystemAd.mutate({
        type: AdType.YouTube,
        title: ytTitle.trim(),
        videoId,
        duration: ytDuration,
      });
      toast.success('YouTube system ad added.');
      setYtOpen(false);
      setYtTitle('');
      setYtUrl('');
      setYtDuration(30);
      await refresh();
    } catch {
      toast.error('Failed to add system ad.');
    } finally {
      setYtSubmitting(false);
    }
  }, [ytTitle, ytUrl, ytDuration, refresh]);

  const submitUpload = useCallback(async () => {
    const file = fileInputRef.current?.files?.[0];
    if (file == null || uploadTitle.trim() === '') {
      toast.error('Choose a file and enter a title.');
      return;
    }
    setUploadSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', uploadTitle.trim());
      const res = await fetch('/api/system-ads/upload', { method: 'POST', body: formData });
      const body = (await res.json()) as { error?: string; storageKey?: string; fileName?: string; fileSize?: number };
      if (!res.ok || body.storageKey == null) {
        toast.error(body.error ?? 'Upload failed.');
        return;
      }
      await client.superAdmin.createSystemAd.mutate({
        type: AdType.Uploaded,
        title: uploadTitle.trim(),
        storageKey: body.storageKey,
        fileName: body.fileName ?? file.name,
        fileSize: body.fileSize ?? file.size,
        duration: uploadDuration,
      });
      toast.success('Uploaded system ad added.');
      setUploadOpen(false);
      setUploadTitle('');
      setUploadDuration(30);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await refresh();
    } catch {
      toast.error('Upload failed.');
    } finally {
      setUploadSubmitting(false);
    }
  }, [uploadTitle, uploadDuration, refresh]);

  const toggleEnabled = useCallback(
    async (ad: SystemAdRow) => {
      setBusyId(ad.id);
      try {
        await client.superAdmin.setSystemAdEnabled.mutate({ id: ad.id, enabled: !ad.enabled });
        await refresh();
      } catch {
        toast.error('Failed to update ad.');
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  const reorder = useCallback(
    async (index: number, direction: 'up' | 'down') => {
      const orderedIds = moveItem(
        ads.map((a) => a.id),
        index,
        direction,
      );
      // Optimistic re-order for a snappy feel; server confirms with `refresh()`.
      setAds((prev) => orderedIds.map((id) => prev.find((a) => a.id === id)).filter((a): a is SystemAdRow => a != null));
      try {
        await client.superAdmin.reorderSystemAds.mutate({ orderedIds });
      } catch {
        toast.error('Failed to reorder.');
        await refresh();
      }
    },
    [ads, refresh],
  );

  const deleteAd = useCallback(
    async (ad: SystemAdRow) => {
      setBusyId(ad.id);
      try {
        await client.superAdmin.deleteSystemAd.mutate({ id: ad.id });
        toast.success('System ad deleted.');
        await refresh();
      } catch {
        toast.error('Failed to delete ad.');
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">System Ads Manager</h2>
          <p className="text-sm text-muted-foreground">
            Plays on every Free-tier Big Display, every 5 minutes, in the order below.
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={ytOpen} onOpenChange={setYtOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">Add YouTube Ad</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add YouTube System Ad</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="yt-title">Title</Label>
                  <Input id="yt-title" value={ytTitle} onChange={(e) => setYtTitle(e.target.value)} placeholder="e.g. Powerbyte Q3 Promo" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="yt-url">YouTube URL or video ID</Label>
                  <Input id="yt-url" value={ytUrl} onChange={(e) => setYtUrl(e.target.value)} placeholder="https://youtu.be/…" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="yt-duration">Duration (seconds)</Label>
                  <Input
                    id="yt-duration"
                    type="number"
                    min={1}
                    value={ytDuration}
                    onChange={(e) => setYtDuration(Number(e.target.value))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setYtOpen(false)} disabled={ytSubmitting}>
                  Cancel
                </Button>
                <Button onClick={() => void submitYoutube()} disabled={ytSubmitting}>
                  {ytSubmitting ? 'Adding…' : 'Add Ad'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button>Upload Ad</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload System Ad</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="up-title">Title</Label>
                  <Input id="up-title" value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder="e.g. Powerbyte Brand Reel" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="up-file">Video or image file</Label>
                  <Input id="up-file" type="file" ref={fileInputRef} accept="video/*,image/*" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="up-duration">Duration (seconds)</Label>
                  <Input
                    id="up-duration"
                    type="number"
                    min={1}
                    value={uploadDuration}
                    onChange={(e) => setUploadDuration(Number(e.target.value))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={uploadSubmitting}>
                  Cancel
                </Button>
                <Button onClick={() => void submitUpload()} disabled={uploadSubmitting}>
                  {uploadSubmitting ? 'Uploading…' : 'Upload'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="space-y-2">
        {ads.map((ad, index) => (
          <Card key={ad.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="flex items-center gap-3">
                <span className="w-6 text-center text-sm tabular-nums text-muted-foreground">{index + 1}</span>
                <div>
                  <p className="font-medium">{ad.title}</p>
                  <p className="text-xs text-muted-foreground">
                    <Badge variant="secondary" className="mr-2">
                      {ad.type === 'youtube' ? 'YouTube' : 'Uploaded'}
                    </Badge>
                    {ad.duration}s
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Switch checked={ad.enabled} onCheckedChange={() => void toggleEnabled(ad)} disabled={busyId === ad.id} aria-label={`Enable ${ad.title}`} />
                  <span className="text-xs text-muted-foreground">{ad.enabled ? 'Enabled' : 'Disabled'}</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => void reorder(index, 'up')} disabled={index === 0}>
                  ↑
                </Button>
                <Button variant="outline" size="sm" onClick={() => void reorder(index, 'down')} disabled={index === ads.length - 1}>
                  ↓
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={busyId === ad.id}>
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete &quot;{ad.title}&quot;?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This ad stops playing on every Free-tier Big Display immediately. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => void deleteAd(ad)}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        ))}
        {ads.length === 0 && (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No system ads yet — add one above.
          </p>
        )}
      </div>
    </div>
  );
}
