import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface RemoteSourceFieldsProps {
  url: string
  setUrl: (val: string) => void
  fetchMode: string
  setFetchMode: (val: string) => void
  updateInterval: string
  setUpdateInterval: (val: string) => void
}

export function RemoteSourceFields({
  url,
  setUrl,
  fetchMode,
  setFetchMode,
  updateInterval,
  setUpdateInterval,
}: RemoteSourceFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label
          htmlFor="url"
          className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase sm:text-xs"
        >
          URL
        </Label>
        <Input
          id="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/sub"
          required
          className="font-mono text-[10px] sm:text-xs"
        />
      </div>

      <div className="grid gap-2">
        <Label
          htmlFor="fetch-mode"
          className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase sm:text-xs"
        >
          Fetch Mode
        </Label>
        <Select
          value={fetchMode}
          onValueChange={(value) => value && setFetchMode(value)}
        >
          <SelectTrigger
            id="fetch-mode"
            className="font-mono text-[10px] sm:text-xs"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="server">Server</SelectItem>
            <SelectItem value="browser">Browser</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label
          htmlFor="update-interval"
          className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase sm:text-xs"
        >
          Update Interval (seconds)
        </Label>
        <Input
          id="update-interval"
          type="number"
          min={1}
          value={updateInterval}
          onChange={(e) => setUpdateInterval(e.target.value)}
          required
          className="font-mono text-[10px] sm:text-xs"
        />
      </div>
    </div>
  )
}
