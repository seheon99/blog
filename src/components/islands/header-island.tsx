"use client";

import { useEffect, useState } from "react";

import { LayoutGrid, Waypoints } from "lucide-react";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { normalizePath } from "@/lib/utils";

export function HeaderIsland() {
  const [view, setView] = useState<"grid" | "graph" | null>();

  useEffect(() => {
    const path = normalizePath(location.pathname);
    if (path === "/graph") {
      setView("graph");
    } else if (path === "/") {
      setView("grid");
    } else {
      setView(null);
    }
  }, []);

  return (
    <div className="flex justify-between">
      <div className="flex items-center gap-2">
        {view !== null && (
          <Tooltip defaultOpen>
            <TooltipTrigger>
              <Button asChild variant="ghost" size="icon-sm">
                {view === "grid" ? (
                  <a href="/graph">
                    <Waypoints />
                  </a>
                ) : view === "graph" ? (
                  <a href="/">
                    <LayoutGrid />
                  </a>
                ) : (
                  <Spinner />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{`Switch to ${view === "graph" ? "grid" : "graph"} view`}</p>
            </TooltipContent>
          </Tooltip>
        )}
        <a href="/">
          <h1 className="text-xl font-bold">seheon blog</h1>
        </a>
      </div>
      <Avatar>
        <AvatarImage
          src="https://github.com/seheon99.png"
          alt="profile image"
        />
        <AvatarFallback>SH</AvatarFallback>
      </Avatar>
    </div>
  );
}
