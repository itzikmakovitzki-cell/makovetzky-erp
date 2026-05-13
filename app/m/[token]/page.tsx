export default async function MagicLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="mb-2 text-lg font-semibold">גישת עובד שטח</h1>
      <p className="text-xs text-muted-foreground">token: {token}</p>
      <p className="mt-4 text-sm">תוקף לטוקן ייבדק כאן, ולפי השיוך תוצג משימה / היתר. placeholder.</p>
    </main>
  );
}
