export type Family = {
  id: string;
  family_name: string;
  access_code: string;
  created_at: string;
};

export type Prompt = {
  id: string;
  title: string;
  instruction: string;
  helper_text: string | null;
  required: boolean;
  sort_order: number;
  location_category: string | null;
  is_bonus: boolean;
};

export type ReviewStatus = "pending" | "approved" | "rejected";

export type Submission = {
  id: string;
  family_id: string;
  prompt_id: string;
  photo_url: string;
  caption: string | null;
  review_status: ReviewStatus;
  include_in_family_collage: boolean;
  include_in_combined_collage: boolean;
  created_at: string;
};
