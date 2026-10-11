"use client";

import { ZapIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const EXAMPLES = ["Tan", "Lim", "Wong", "Nguyen", "Kim", "Murphy", "García", "Pereira"];

export function HeroForm() {
  const router = useRouter();
  const [surname, setSurname] = useState("");
  const [name, setName] = useState("");

  function start(s = surname) {
    const clean = s.trim();
    if (!clean) return;
    const q = new URLSearchParams({ surname: clean });
    if (name.trim()) q.set("name", name.trim());
    router.push(`/create?${q}`);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start();
      }}
      className="comic-box relative space-y-4 bg-white p-5 sm:p-6"
    >
      <div className="space-y-1.5">
        <Label htmlFor="surname" className="comic-title text-2xl">
          Your surname
        </Label>
        <Input
          id="surname"
          required
          autoFocus
          maxLength={40}
          autoComplete="family-name"
          value={surname}
          onChange={(e) => setSurname(e.target.value)}
          placeholder="e.g. Tan"
          className="h-14 text-2xl"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="name" className="comic-title text-xl">
          Your first name <span className="font-sans text-sm font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="name"
          maxLength={40}
          autoComplete="given-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="So the comic can call you by name"
        />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={!surname.trim()}>
        <ZapIcon className="fill-current" /> Begin my saga!
      </Button>
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <span className="text-muted-foreground">Try:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setSurname(ex)}
            className="border-2 border-ink bg-paper px-2 py-0.5 font-bold transition-colors hover:bg-pow"
          >
            {ex}
          </button>
        ))}
      </div>
    </form>
  );
}
