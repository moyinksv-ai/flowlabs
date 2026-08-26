export default async function handler(_req, res) {
  return res.status(200).json({ ok: true, service: 'flowlab', version: '3.2.0' });
}
