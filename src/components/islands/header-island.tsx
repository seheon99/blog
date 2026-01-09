"use client";

import { useEffect, useState } from "react";

import { LayoutList, Map } from "lucide-react";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function HeaderIsland() {
  const [view, setView] = useState<"list" | "graph" | null>(null);
  const [href, setHref] = useState("/");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("graph") === "true") {
      params.delete("graph");
      setView("graph");
    } else {
      params.set("graph", "true");
      setView("list");
    }
    const search = params.toString();
    setHref(search ? `/?${search}` : "/");
  }, []);

  return (
    <div className="flex justify-between">
      <div className="flex items-center gap-2">
        <Tooltip defaultOpen>
          <TooltipTrigger>
            <Button asChild variant="ghost" size="icon-sm">
              <a href={href}>
                {view === "list" ? (
                  <Map />
                ) : view === "graph" ? (
                  <LayoutList />
                ) : (
                  <Spinner />
                )}
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{`Switch to ${view === "graph" ? "list" : "graph"} view`}</p>
          </TooltipContent>
        </Tooltip>
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
