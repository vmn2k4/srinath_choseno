export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      boundary_uploads: {
        Row: {
          boundary_type: string
          completed_at: string | null
          country: string
          created_at: string | null
          expected_count: number | null
          id: string
          name: string
          uploaded_by: string | null
        }
        Insert: {
          boundary_type: string
          completed_at?: string | null
          country: string
          created_at?: string | null
          expected_count?: number | null
          id?: string
          name: string
          uploaded_by?: string | null
        }
        Update: {
          boundary_type?: string
          completed_at?: string | null
          country?: string
          created_at?: string | null
          expected_count?: number | null
          id?: string
          name?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "boundary_uploads_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      candidacy_claim_requests: {
        Row: {
          candidate_id: string
          contact_email: string | null
          id: string
          motivation: string | null
          requester_profile_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          social_media_info: string | null
          status: string
          submitted_at: string
        }
        Insert: {
          candidate_id: string
          contact_email?: string | null
          id?: string
          motivation?: string | null
          requester_profile_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          social_media_info?: string | null
          status?: string
          submitted_at?: string
        }
        Update: {
          candidate_id?: string
          contact_email?: string | null
          id?: string
          motivation?: string | null
          requester_profile_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          social_media_info?: string | null
          status?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidacy_claim_requests_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "election_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidacy_claim_requests_requester_profile_id_fkey"
            columns: ["requester_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidacy_claim_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_claim_invites: {
        Row: {
          candidate_id: string
          created_at: string
          created_by: string
          email: string
          expires_at: string
          id: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          candidate_id: string
          created_at?: string
          created_by: string
          email: string
          expires_at: string
          id?: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string
          created_by?: string
          email?: string
          expires_at?: string
          id?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_claim_invites_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "election_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_claim_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          content: string
          created_at: string | null
          ghost_id: string
          id: string
          post_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          ghost_id: string
          id?: string
          post_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          ghost_id?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      countries: {
        Row: {
          code: string | null
          created_at: string | null
          flag_emoji: string | null
          name: string
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          flag_emoji?: string | null
          name: string
        }
        Update: {
          code?: string | null
          created_at?: string | null
          flag_emoji?: string | null
          name?: string
        }
        Relationships: []
      }
      country_boundary_types: {
        Row: {
          admin_only: boolean
          country: string
          created_at: string | null
          id: string
          is_container: boolean
          rank: number
          type_name: string
        }
        Insert: {
          admin_only?: boolean
          country: string
          created_at?: string | null
          id?: string
          is_container?: boolean
          rank: number
          type_name: string
        }
        Update: {
          admin_only?: boolean
          country?: string
          created_at?: string | null
          id?: string
          is_container?: boolean
          rank?: number
          type_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "country_boundary_types_country_fkey"
            columns: ["country"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["name"]
          },
        ]
      }
      designations: {
        Row: {
          country: string
          id: string
          name: string
        }
        Insert: {
          country: string
          id?: string
          name: string
        }
        Update: {
          country?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      election_administrators: {
        Row: {
          contact_email: string | null
          id: string
          motivation: string | null
          profile_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          seat_id: string
          social_media_info: string | null
          status: string
          submitted_at: string
        }
        Insert: {
          contact_email?: string | null
          id?: string
          motivation?: string | null
          profile_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          seat_id: string
          social_media_info?: string | null
          status?: string
          submitted_at?: string
        }
        Update: {
          contact_email?: string | null
          id?: string
          motivation?: string | null
          profile_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          seat_id?: string
          social_media_info?: string | null
          status?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "election_administrators_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "election_administrators_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "election_administrators_seat_id_fkey"
            columns: ["seat_id"]
            isOneToOne: false
            referencedRelation: "election_seats"
            referencedColumns: ["id"]
          },
        ]
      }
      election_answer_comments: {
        Row: {
          answer_id: string
          content: string
          created_at: string
          ghost_id: string
          id: string
        }
        Insert: {
          answer_id: string
          content: string
          created_at?: string
          ghost_id: string
          id?: string
        }
        Update: {
          answer_id?: string
          content?: string
          created_at?: string
          ghost_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "election_answer_comments_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "election_candidate_answers"
            referencedColumns: ["id"]
          },
        ]
      }
      election_candidate_answer_options: {
        Row: {
          answer_id: string
          id: string
          option_id: string
        }
        Insert: {
          answer_id: string
          id?: string
          option_id: string
        }
        Update: {
          answer_id?: string
          id?: string
          option_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "election_candidate_answer_options_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "election_candidate_answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "election_candidate_answer_options_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "election_question_options"
            referencedColumns: ["id"]
          },
        ]
      }
      election_candidate_answers: {
        Row: {
          candidate_id: string
          context_text: string | null
          id: string
          option_id: string | null
          question_id: string
          rating_value: number | null
          text_answer: string | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          candidate_id: string
          context_text?: string | null
          id?: string
          option_id?: string | null
          question_id: string
          rating_value?: number | null
          text_answer?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          candidate_id?: string
          context_text?: string | null
          id?: string
          option_id?: string | null
          question_id?: string
          rating_value?: number | null
          text_answer?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "election_candidate_answers_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "election_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "election_candidate_answers_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "election_question_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "election_candidate_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "election_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      election_candidates: {
        Row: {
          added_by_election_admin_id: string | null
          claimed_at: string | null
          created_at: string | null
          id: string
          intro_video_url: string | null
          nomination_filed: boolean
          politician_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          seat_id: string
          statement: string | null
          status: string
          submitted_at: string | null
        }
        Insert: {
          added_by_election_admin_id?: string | null
          claimed_at?: string | null
          created_at?: string | null
          id?: string
          intro_video_url?: string | null
          nomination_filed?: boolean
          politician_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          seat_id: string
          statement?: string | null
          status?: string
          submitted_at?: string | null
        }
        Update: {
          added_by_election_admin_id?: string | null
          claimed_at?: string | null
          created_at?: string | null
          id?: string
          intro_video_url?: string | null
          nomination_filed?: boolean
          politician_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          seat_id?: string
          statement?: string | null
          status?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "election_candidates_added_by_election_admin_id_fkey"
            columns: ["added_by_election_admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "election_candidates_politician_id_fkey"
            columns: ["politician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "election_candidates_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "election_candidates_seat_id_fkey"
            columns: ["seat_id"]
            isOneToOne: false
            referencedRelation: "election_seats"
            referencedColumns: ["id"]
          },
        ]
      }
      election_notification_dismissals: {
        Row: {
          dismissed_at: string | null
          election_id: string
          profile_id: string
        }
        Insert: {
          dismissed_at?: string | null
          election_id: string
          profile_id: string
        }
        Update: {
          dismissed_at?: string | null
          election_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "election_notification_dismissals_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "elections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "election_notification_dismissals_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      election_question_options: {
        Row: {
          id: string
          option_text: string
          question_id: string
          rank: number
        }
        Insert: {
          id?: string
          option_text: string
          question_id: string
          rank?: number
        }
        Update: {
          id?: string
          option_text?: string
          question_id?: string
          rank?: number
        }
        Relationships: [
          {
            foreignKeyName: "election_question_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "election_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      election_questions: {
        Row: {
          allow_context: boolean
          created_at: string
          election_id: string
          id: string
          question_text: string
          question_type: string
          rank: number
          required: boolean
          visible_to_public: boolean
        }
        Insert: {
          allow_context?: boolean
          created_at?: string
          election_id: string
          id?: string
          question_text: string
          question_type?: string
          rank?: number
          required?: boolean
          visible_to_public?: boolean
        }
        Update: {
          allow_context?: boolean
          created_at?: string
          election_id?: string
          id?: string
          question_text?: string
          question_type?: string
          rank?: number
          required?: boolean
          visible_to_public?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "election_questions_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "elections"
            referencedColumns: ["id"]
          },
        ]
      }
      election_role_types: {
        Row: {
          boundary_type: string
          country: string
          created_at: string | null
          id: string
          region_override: string
          role_key: string
          role_title: string
        }
        Insert: {
          boundary_type: string
          country: string
          created_at?: string | null
          id?: string
          region_override?: string
          role_key: string
          role_title: string
        }
        Update: {
          boundary_type?: string
          country?: string
          created_at?: string | null
          id?: string
          region_override?: string
          role_key?: string
          role_title?: string
        }
        Relationships: [
          {
            foreignKeyName: "election_role_types_country_boundary_type_fkey"
            columns: ["country", "boundary_type"]
            isOneToOne: false
            referencedRelation: "country_boundary_types"
            referencedColumns: ["country", "type_name"]
          },
        ]
      }
      election_seats: {
        Row: {
          created_at: string | null
          election_id: string
          id: string
          map_shape_id: number
          role_title: string
        }
        Insert: {
          created_at?: string | null
          election_id: string
          id?: string
          map_shape_id: number
          role_title: string
        }
        Update: {
          created_at?: string | null
          election_id?: string
          id?: string
          map_shape_id?: number
          role_title?: string
        }
        Relationships: [
          {
            foreignKeyName: "election_seats_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "elections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "election_seats_map_shape_id_fkey"
            columns: ["map_shape_id"]
            isOneToOne: false
            referencedRelation: "map_shapes"
            referencedColumns: ["id"]
          },
        ]
      }
      elections: {
        Row: {
          created_at: string | null
          created_by: string | null
          election_date: string
          id: string
          name: string
          status: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          election_date: string
          id?: string
          name: string
          status?: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          election_date?: string
          id?: string
          name?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "elections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      federal_election_candidates: {
        Row: {
          candidate_name: string
          elected: boolean
          election_event_id: number
          id: string
          map_shape_id: number
          party_name: string | null
          scraped_at: string
          source_url: string
        }
        Insert: {
          candidate_name: string
          elected?: boolean
          election_event_id: number
          id?: string
          map_shape_id: number
          party_name?: string | null
          scraped_at?: string
          source_url: string
        }
        Update: {
          candidate_name?: string
          elected?: boolean
          election_event_id?: number
          id?: string
          map_shape_id?: number
          party_name?: string | null
          scraped_at?: string
          source_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "federal_election_candidates_election_event_id_fkey"
            columns: ["election_event_id"]
            isOneToOne: false
            referencedRelation: "federal_election_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "federal_election_candidates_map_shape_id_fkey"
            columns: ["map_shape_id"]
            isOneToOne: false
            referencedRelation: "map_shapes"
            referencedColumns: ["id"]
          },
        ]
      }
      federal_election_events: {
        Row: {
          discovered_at: string
          ev_type: number
          event_date: string | null
          id: number
          is_general: boolean
          name: string
        }
        Insert: {
          discovered_at?: string
          ev_type: number
          event_date?: string | null
          id: number
          is_general?: boolean
          name: string
        }
        Update: {
          discovered_at?: string
          ev_type?: number
          event_date?: string | null
          id?: number
          is_general?: boolean
          name?: string
        }
        Relationships: []
      }
      map_shapes: {
        Row: {
          boundary_type: string
          code: string | null
          country: string
          created_at: string | null
          geom: unknown
          id: number
          name: string
          properties: Json | null
          retired_at: string | null
          upload_id: string | null
        }
        Insert: {
          boundary_type: string
          code?: string | null
          country: string
          created_at?: string | null
          geom?: unknown
          id?: number
          name: string
          properties?: Json | null
          retired_at?: string | null
          upload_id?: string | null
        }
        Update: {
          boundary_type?: string
          code?: string | null
          country?: string
          created_at?: string | null
          geom?: unknown
          id?: number
          name?: string
          properties?: Json | null
          retired_at?: string | null
          upload_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "map_shapes_type_fk"
            columns: ["country", "boundary_type"]
            isOneToOne: false
            referencedRelation: "country_boundary_types"
            referencedColumns: ["country", "type_name"]
          },
          {
            foreignKeyName: "map_shapes_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "boundary_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      political_parties: {
        Row: {
          country: string
          created_at: string
          id: number
          name: string
          rank: number
        }
        Insert: {
          country: string
          created_at?: string
          id?: number
          name: string
          rank?: number
        }
        Update: {
          country?: string
          created_at?: string
          id?: number
          name?: string
          rank?: number
        }
        Relationships: [
          {
            foreignKeyName: "political_parties_country_fkey"
            columns: ["country"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["name"]
          },
        ]
      }
      politician_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          education: string | null
          hometown: string | null
          id: string
          political_party_id: number | null
          political_target_role: string | null
          target_boundary_id: string | null
          target_boundary_name: string | null
          target_boundary_type: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          education?: string | null
          hometown?: string | null
          id: string
          political_party_id?: number | null
          political_target_role?: string | null
          target_boundary_id?: string | null
          target_boundary_name?: string | null
          target_boundary_type?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          education?: string | null
          hometown?: string | null
          id?: string
          political_party_id?: number | null
          political_target_role?: string | null
          target_boundary_id?: string | null
          target_boundary_name?: string | null
          target_boundary_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "politician_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "politician_profiles_political_party_id_fkey"
            columns: ["political_party_id"]
            isOneToOne: false
            referencedRelation: "political_parties"
            referencedColumns: ["id"]
          },
        ]
      }
      politician_supporters: {
        Row: {
          created_at: string | null
          politician_id: string
          supporter_id: string
        }
        Insert: {
          created_at?: string | null
          politician_id: string
          supporter_id: string
        }
        Update: {
          created_at?: string | null
          politician_id?: string
          supporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "politician_supporters_politician_id_fkey"
            columns: ["politician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "politician_supporters_supporter_id_fkey"
            columns: ["supporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_boundaries: {
        Row: {
          map_shape_id: number
          post_id: string
        }
        Insert: {
          map_shape_id: number
          post_id: string
        }
        Update: {
          map_shape_id?: number
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_boundaries_map_shape_id_fkey"
            columns: ["map_shape_id"]
            isOneToOne: false
            referencedRelation: "map_shapes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_boundaries_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_votes: {
        Row: {
          created_at: string | null
          ghost_id: string
          post_id: string
          vote_type: number
        }
        Insert: {
          created_at?: string | null
          ghost_id: string
          post_id: string
          vote_type: number
        }
        Update: {
          created_at?: string | null
          ghost_id?: string
          post_id?: string
          vote_type?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          civic_score_snapshot: number | null
          content: string
          country: string | null
          created_at: string | null
          dislikes_count: number | null
          election_candidate_id: string | null
          ghost_id: string
          id: string
          image_url: string | null
          is_country: boolean | null
          is_international: boolean | null
          likes_count: number | null
          link_metadata: Json | null
          video_url: string | null
          wall_ghost_id: string | null
        }
        Insert: {
          civic_score_snapshot?: number | null
          content: string
          country?: string | null
          created_at?: string | null
          dislikes_count?: number | null
          election_candidate_id?: string | null
          ghost_id: string
          id?: string
          image_url?: string | null
          is_country?: boolean | null
          is_international?: boolean | null
          likes_count?: number | null
          link_metadata?: Json | null
          video_url?: string | null
          wall_ghost_id?: string | null
        }
        Update: {
          civic_score_snapshot?: number | null
          content?: string
          country?: string | null
          created_at?: string | null
          dislikes_count?: number | null
          election_candidate_id?: string | null
          ghost_id?: string
          id?: string
          image_url?: string | null
          is_country?: boolean | null
          is_international?: boolean | null
          likes_count?: number | null
          link_metadata?: Json | null
          video_url?: string | null
          wall_ghost_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_election_candidate_id_fkey"
            columns: ["election_candidate_id"]
            isOneToOne: false
            referencedRelation: "election_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          burn_count: number
          cached_total_score: number
          civic_score: number
          constituency: string | null
          country: string | null
          current_ghost_id: string | null
          designation: string | null
          full_name: string | null
          id: string
          last_burned_at: string | null
          onboarding_completed: boolean | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          burn_count?: number
          cached_total_score?: number
          civic_score?: number
          constituency?: string | null
          country?: string | null
          current_ghost_id?: string | null
          designation?: string | null
          full_name?: string | null
          id: string
          last_burned_at?: string | null
          onboarding_completed?: boolean | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          burn_count?: number
          cached_total_score?: number
          civic_score?: number
          constituency?: string | null
          country?: string | null
          current_ghost_id?: string | null
          designation?: string | null
          full_name?: string | null
          id?: string
          last_burned_at?: string | null
          onboarding_completed?: boolean | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      provincial_election_candidates: {
        Row: {
          candidate_name: string
          elected: boolean
          election_event_id: string
          id: string
          map_shape_id: number
          party_name: string | null
          scraped_at: string
        }
        Insert: {
          candidate_name: string
          elected?: boolean
          election_event_id: string
          id?: string
          map_shape_id: number
          party_name?: string | null
          scraped_at?: string
        }
        Update: {
          candidate_name?: string
          elected?: boolean
          election_event_id?: string
          id?: string
          map_shape_id?: number
          party_name?: string | null
          scraped_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provincial_election_candidates_election_event_id_fkey"
            columns: ["election_event_id"]
            isOneToOne: false
            referencedRelation: "provincial_election_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provincial_election_candidates_map_shape_id_fkey"
            columns: ["map_shape_id"]
            isOneToOne: false
            referencedRelation: "map_shapes"
            referencedColumns: ["id"]
          },
        ]
      }
      provincial_election_events: {
        Row: {
          discovered_at: string
          event_date: string | null
          id: string
          name: string
          province: string
          source_url: string
        }
        Insert: {
          discovered_at?: string
          event_date?: string | null
          id?: string
          name: string
          province: string
          source_url: string
        }
        Update: {
          discovered_at?: string
          event_date?: string | null
          id?: string
          name?: string
          province?: string
          source_url?: string
        }
        Relationships: []
      }
      shape_containers: {
        Row: {
          container_shape_id: number
          map_shape_id: number
        }
        Insert: {
          container_shape_id: number
          map_shape_id: number
        }
        Update: {
          container_shape_id?: number
          map_shape_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "shape_containers_container_shape_id_fkey"
            columns: ["container_shape_id"]
            isOneToOne: false
            referencedRelation: "map_shapes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shape_containers_map_shape_id_fkey"
            columns: ["map_shape_id"]
            isOneToOne: false
            referencedRelation: "map_shapes"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          id: number
          theme: string
          updated_at: string | null
        }
        Insert: {
          id?: number
          theme?: string
          updated_at?: string | null
        }
        Update: {
          id?: number
          theme?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      us_federal_election_candidates: {
        Row: {
          candidate_name: string
          candidate_status: string | null
          cycle: number
          fec_candidate_id: string
          id: string
          incumbent_challenge: string | null
          map_shape_id: number | null
          office: string
          party_name: string | null
          scraped_at: string
          source_url: string
        }
        Insert: {
          candidate_name: string
          candidate_status?: string | null
          cycle: number
          fec_candidate_id: string
          id?: string
          incumbent_challenge?: string | null
          map_shape_id?: number | null
          office: string
          party_name?: string | null
          scraped_at?: string
          source_url: string
        }
        Update: {
          candidate_name?: string
          candidate_status?: string | null
          cycle?: number
          fec_candidate_id?: string
          id?: string
          incumbent_challenge?: string | null
          map_shape_id?: number | null
          office?: string
          party_name?: string | null
          scraped_at?: string
          source_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "us_federal_election_candidates_map_shape_id_fkey"
            columns: ["map_shape_id"]
            isOneToOne: false
            referencedRelation: "map_shapes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_boundary_memberships: {
        Row: {
          map_shape_id: number
          profile_id: string
          updated_at: string | null
        }
        Insert: {
          map_shape_id: number
          profile_id: string
          updated_at?: string | null
        }
        Update: {
          map_shape_id?: number
          profile_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_boundary_memberships_map_shape_id_fkey"
            columns: ["map_shape_id"]
            isOneToOne: false
            referencedRelation: "map_shapes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_boundary_memberships_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_locations: {
        Row: {
          created_at: string | null
          federal_boundary_id: string | null
          ghost_id: string | null
          id: string
          latitude: number
          longitude: number
          polling_district_id: string | null
          profile_id: string
        }
        Insert: {
          created_at?: string | null
          federal_boundary_id?: string | null
          ghost_id?: string | null
          id?: string
          latitude: number
          longitude: number
          polling_district_id?: string | null
          profile_id: string
        }
        Update: {
          created_at?: string | null
          federal_boundary_id?: string | null
          ghost_id?: string | null
          id?: string
          latitude?: number
          longitude?: number
          polling_district_id?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_locations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      add_unregistered_candidate:
        | {
            Args: {
              p_bio: string
              p_education: string
              p_full_name: string
              p_hometown: string
              p_party_id: number
              p_seat_id: string
            }
            Returns: {
              added_by_election_admin_id: string | null
              claimed_at: string | null
              created_at: string | null
              id: string
              intro_video_url: string | null
              nomination_filed: boolean
              politician_id: string
              reviewed_at: string | null
              reviewed_by: string | null
              seat_id: string
              statement: string | null
              status: string
              submitted_at: string | null
            }
            SetofOptions: {
              from: "*"
              to: "election_candidates"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              p_avatar_url?: string
              p_bio: string
              p_education: string
              p_full_name: string
              p_hometown: string
              p_party_id: number
              p_seat_id: string
            }
            Returns: {
              added_by_election_admin_id: string | null
              claimed_at: string | null
              created_at: string | null
              id: string
              intro_video_url: string | null
              nomination_filed: boolean
              politician_id: string
              reviewed_at: string | null
              reviewed_by: string | null
              seat_id: string
              statement: string | null
              status: string
              submitted_at: string | null
            }
            SetofOptions: {
              from: "*"
              to: "election_candidates"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      add_user_boundary_membership: {
        Args: { p_map_shape_id: number }
        Returns: undefined
      }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      apply_for_election_admin: {
        Args: {
          p_contact_email: string
          p_motivation: string
          p_seat_id: string
          p_social_media_info: string
        }
        Returns: {
          contact_email: string | null
          id: string
          motivation: string | null
          profile_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          seat_id: string
          social_media_info: string | null
          status: string
          submitted_at: string
        }
        SetofOptions: {
          from: "*"
          to: "election_administrators"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      apply_for_seat: {
        Args: { p_seat_id: string; p_statement: string }
        Returns: {
          added_by_election_admin_id: string | null
          claimed_at: string | null
          created_at: string | null
          id: string
          intro_video_url: string | null
          nomination_filed: boolean
          politician_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          seat_id: string
          statement: string | null
          status: string
          submitted_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "election_candidates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      burn_ghost_identity: { Args: never; Returns: undefined }
      calculate_my_score: { Args: never; Returns: number }
      claim_candidacy_via_token: {
        Args: { p_token: string }
        Returns: {
          added_by_election_admin_id: string | null
          claimed_at: string | null
          created_at: string | null
          id: string
          intro_video_url: string | null
          nomination_filed: boolean
          politician_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          seat_id: string
          statement: string | null
          status: string
          submitted_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "election_candidates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_claim_invite: {
        Args: { p_candidate_id: string; p_email: string }
        Returns: string
      }
      create_post: {
        Args: {
          p_content: string
          p_image_url?: string
          p_link_metadata?: Json
          p_video_url?: string
        }
        Returns: {
          civic_score_snapshot: number | null
          content: string
          country: string | null
          created_at: string | null
          dislikes_count: number | null
          election_candidate_id: string | null
          ghost_id: string
          id: string
          image_url: string | null
          is_country: boolean | null
          is_international: boolean | null
          likes_count: number | null
          link_metadata: Json | null
          video_url: string | null
          wall_ghost_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "posts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_boundary_upload: {
        Args: { p_upload_id: string }
        Returns: undefined
      }
      delete_shapes: { Args: { p_shape_ids: number[] }; Returns: undefined }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      finalize_candidate_claim: {
        Args: { p_candidate_id: string; p_claiming_profile_id: string }
        Returns: undefined
      }
      find_boundaries_by_point: {
        Args: { lat: number; lng: number }
        Returns: {
          boundary_type: string
          code: string
          country: string
          id: number
          name: string
          rank: number
        }[]
      }
      find_open_seats_in_container: {
        Args: { p_container_shape_id: number }
        Returns: {
          boundary_type: string
          election_date: string
          election_id: string
          election_name: string
          election_status: string
          map_shape_id: number
          role_title: string
          seat_id: string
          shape_name: string
        }[]
      }
      find_shapes_in_containers: {
        Args: {
          p_container_shape_ids: number[]
          p_country?: string
          p_target_boundary_type: string
        }
        Returns: {
          code: string
          id: number
          name: string
        }[]
      }
      find_shapes_within: {
        Args: {
          p_container_shape_id: number
          p_country?: string
          p_target_boundary_type: string
        }
        Returns: {
          code: string
          id: number
          name: string
        }[]
      }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_active_elections_for_user: {
        Args: never
        Returns: {
          election_date: string
          election_id: string
          election_name: string
          role_title: string
          seat_id: string
        }[]
      }
      get_geojson_shapes:
        | {
            Args: never
            Returns: {
              geojson: Json
              id: number
            }[]
          }
        | {
            Args: { ids?: number[] }
            Returns: {
              geojson: Json
              id: number
            }[]
          }
      get_seat_admin_status: {
        Args: { p_seat_id: string }
        Returns: {
          has_approved_admin: boolean
          my_application_status: string
        }[]
      }
      gettransactionid: { Args: never; Returns: unknown }
      insert_map_shape:
        | {
            Args: {
              p_boundary_type: string
              p_code: string
              p_country: string
              p_geojson: Json
              p_name: string
              p_properties: Json
            }
            Returns: undefined
          }
        | {
            Args: {
              p_boundary_type: string
              p_code: string
              p_country: string
              p_geojson: Json
              p_name: string
              p_properties: Json
              p_upload_id?: string
            }
            Returns: undefined
          }
      insert_map_shapes_batch: { Args: { p_shapes: Json }; Returns: number }
      is_claim_reviewer_for_candidate: {
        Args: { p_candidate_id: string }
        Returns: boolean
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      preview_retirement_coverage_gap: {
        Args: { p_shape_ids: number[] }
        Returns: {
          affected_profile_id: string
        }[]
      }
      promote_expired_election_admin_applications: {
        Args: { p_seat_id?: string }
        Returns: undefined
      }
      recompute_shape_containers_for_container: {
        Args: { p_container_id: number }
        Returns: undefined
      }
      recompute_shape_containers_for_shape: {
        Args: { p_shape_id: number }
        Returns: undefined
      }
      remove_unregistered_candidate: {
        Args: { p_candidate_id: string }
        Returns: undefined
      }
      request_candidacy_claim: {
        Args: {
          p_candidate_id: string
          p_contact_email: string
          p_motivation: string
          p_social_media_info: string
        }
        Returns: {
          candidate_id: string
          contact_email: string | null
          id: string
          motivation: string | null
          requester_profile_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          social_media_info: string | null
          status: string
          submitted_at: string
        }
        SetofOptions: {
          from: "*"
          to: "candidacy_claim_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_region_names: {
        Args: { p_country: string; p_shape_ids: number[] }
        Returns: {
          map_shape_id: number
          region_name: string
        }[]
      }
      retire_shapes: { Args: { p_shape_ids: number[] }; Returns: undefined }
      review_candidacy_claim: {
        Args: { p_approve: boolean; p_request_id: string }
        Returns: {
          candidate_id: string
          contact_email: string | null
          id: string
          motivation: string | null
          requester_profile_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          social_media_info: string | null
          status: string
          submitted_at: string
        }
        SetofOptions: {
          from: "*"
          to: "candidacy_claim_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_election_admin_application: {
        Args: { p_application_id: string; p_approve: boolean }
        Returns: {
          contact_email: string | null
          id: string
          motivation: string | null
          profile_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          seat_id: string
          social_media_info: string | null
          status: string
          submitted_at: string
        }
        SetofOptions: {
          from: "*"
          to: "election_administrators"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      submit_candidate_application: {
        Args: { p_candidate_id: string }
        Returns: {
          added_by_election_admin_id: string | null
          claimed_at: string | null
          created_at: string | null
          id: string
          intro_video_url: string | null
          nomination_filed: boolean
          politician_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          seat_id: string
          statement: string | null
          status: string
          submitted_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "election_candidates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      suggest_replaced_shapes: {
        Args: { p_upload_id: string }
        Returns: {
          boundary_type: string
          code: string | null
          country: string
          created_at: string | null
          geom: unknown
          id: number
          name: string
          properties: Json | null
          retired_at: string | null
          upload_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "map_shapes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      sync_user_boundary_memberships: {
        Args: { p_lat: number; p_lng: number }
        Returns: {
          map_shape_id: number
          profile_id: string
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "user_boundary_memberships"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      unlockrows: { Args: { "": string }; Returns: number }
      update_unregistered_candidate: {
        Args: {
          p_bio: string
          p_candidate_id: string
          p_education: string
          p_full_name: string
          p_hometown: string
          p_party_id: number
        }
        Returns: {
          added_by_election_admin_id: string | null
          claimed_at: string | null
          created_at: string | null
          id: string
          intro_video_url: string | null
          nomination_filed: boolean
          politician_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          seat_id: string
          statement: string | null
          status: string
          submitted_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "election_candidates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
      vote_on_post: {
        Args: { p_post_id: string; p_vote_type: number }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
