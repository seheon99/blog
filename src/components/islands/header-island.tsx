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
  const [view, setView] = useState<"list" | "graph" | "article">(null);

  useEffect(() => {
    if (location.pathname === "/") {
      setView("list");
    } else if (location.pathname === "/graph") {
      setView("graph");
    } else if (location.pathname.startsWith("/articles")) {
      setView("article");
    } else {
      setView(null);
    }
  }, []);

  return (
    <div className="flex justify-between">
      <div className="flex items-center gap-2">
        {["list", "graph", null].includes(view) && (
          <Tooltip defaultOpen>
            <TooltipTrigger>
              <Button asChild variant="outline" size="icon-sm">
                <a href={view === "list" ? "/graph" : "/"}>
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
              <p>
                {view === "list"
                  ? "Switch to graph view"
                  : "Switch to list view"}
              </p>
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
