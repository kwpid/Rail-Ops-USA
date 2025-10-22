import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Newspaper, Calendar } from "lucide-react";

const NEWS_ITEMS = [
  {
    id: "1",
    date: new Date("2025-01-15").getTime(),
    title: "Welcome to Rail Ops: USA",
    description: "Build your railroad empire from the ground up! Start with a single locomotive and $500,000 in capital. Haul freight across America, upgrade your fleet, and expand your operations.",
  },
  {
    id: "2",
    date: new Date("2025-01-10").getTime(),
    title: "Tier System Introduced",
    description: "Jobs are now organized into three tiers: Local Freight (unlocked), Mainline Freight (Level 10+), and Special Freight (Level 50+). Each tier offers bigger payouts and more challenging routes.",
  },
  {
    id: "3",
    date: new Date("2025-01-05").getTime(),
    title: "Locomotive Customization",
    description: "Customize your locomotives! Change unit numbers for $10,000. Make sure each ID is unique across your fleet. Future updates will include livery customization options.",
  },
  {
    id: "4",
    date: new Date("2025-01-01").getTime(),
    title: "Game Launch",
    description: "Rail Ops: USA is now live! Experience authentic railroad management with detailed locomotive stats, realistic freight jobs, and a comprehensive leveling system. Good luck, railroader!",
  },
];

export default function News() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Newspaper className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-accent font-bold">News & Updates</h1>
          <p className="text-muted-foreground">Latest announcements and game updates</p>
        </div>
      </div>

      <div className="space-y-4">
        {NEWS_ITEMS.map((item, idx) => (
          <Card key={item.id} data-testid={`news-item-${idx}`}>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <CardTitle className="text-xl">{item.title}</CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(item.date).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </CardDescription>
                </div>
                {idx === 0 && <Badge>New</Badge>}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{item.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Separator />

      <div className="text-center text-sm text-muted-foreground p-6">
        <p>Check back regularly for new features, events, and updates!</p>
      </div>
    </div>
  );
}
