
-- Allow public delete on submissions (families can remove their own photos via the app)
CREATE POLICY "Public can delete submissions"
ON public.submissions
FOR DELETE
TO public
USING (true);

-- Allow public delete on photos bucket objects
CREATE POLICY "Public can delete photos"
ON storage.objects
FOR DELETE
TO public
USING (bucket_id = 'photos');
