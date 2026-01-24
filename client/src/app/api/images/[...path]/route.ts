/**
 * Next.js API Route to proxy images from backend
 * This bypasses CORS issues by serving images through Next.js
 * 
 * Path: /api/images/uploads/profiles/filename.png
 * Backend: http://localhost:5000/uploads/profiles/filename.png
 */

export async function GET(
    request: Request,
    { params }: { params: { path: string[] } }
) {
    // Await params in Next.js 15 (or just use directly in 14)
    const resolvedParams = await Promise.resolve(params);
    const imagePath = resolvedParams.path.join('/');
    const backendUrl = 'http://localhost:5000';
    
    // The path already includes 'uploads/profiles/...' so don't add /uploads again
    const imageUrl = `${backendUrl}/${imagePath}`;

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

