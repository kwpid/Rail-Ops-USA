import { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Newspaper, Calendar } from "lucide-react";
import type { NewsItem } from "@shared/schema";

export default function News() {
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const newsRef = collection(db, "news");
    const q = query(newsRef, orderBy("date", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as NewsItem));
      setNewsItems(items);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <Newspaper className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-accent font-bold">News & Updates</h1>
            <p className="text-muted-foreground">Latest announcements and game updates</p>
          </div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-2/3 mb-2"></div>
                <div className="h-4 bg-muted rounded w-1/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-muted rounded w-full mb-2"></div>
                <div className="h-4 bg-muted rounded w-5/6"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Newspaper className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-accent font-bold">News & Updates</h1>
          <p className="text-muted-foreground">Latest announcements and game updates</p>
        </div>
      </div>

      {newsItems.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Newspaper className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No news items yet. Check back soon!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {newsItems.map((item, idx) => {
            const isNew = idx === 0 && Date.now() - item.date < 7 * 24 * 60 * 60 * 1000; // New if within 7 days
            return (
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
                    {isNew && <Badge data-testid="badge-new">New</Badge>}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed">{item.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Separator />

      <div className="text-center text-sm text-muted-foreground p-6">
        <p>Check back regularly for new features, events, and updates!</p>
      </div>
    </div>
  );
}
