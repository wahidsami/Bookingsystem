/**
 * Next.js API Route to proxy images from backend
 * This bypasses CORS issues by serving images through Next.js
 * 
 * Path: /api/images/uploads/profiles/filename.png
 * Backend: {NEXT_PUBLIC_SERVER_URL}/uploads/profiles/filename.png
 */

import { SERVER_URL } from "@/lib/runtime";

export async function GET(
    request: Request,
    { params }: { params: { path: string[] } }
) {
    // Await params in Next.js 15 (or just use directly in 14)
    const resolvedParams = await Promise.resolve(params);
    const imagePath = resolvedParams.path.join('/');

    // The path already includes 'uploads/profiles/...' so don't add /uploads again
    const imageUrl = `${SERVER_URL}/${imagePath}`;

    console.log('Proxying image:', imageUrl);

    try {
        const response = await fetch(imageUrl);
        
        if (!response.ok) {
            console.error('Backend returned:', response.status, response.statusText);
            return new Response('Image not found', { status: 404 });
        }

        const imageBuffer = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || 'image/png';

        return new Response(imageBuffer, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        });
    } catch (error) {
        console.error('Error proxying image:', error);
        return new Response('Error loading image', { status: 500 });
    }
}

