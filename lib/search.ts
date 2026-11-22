export interface ProductSearchResult {
  title: string;
  url: string;
  imageUrl?: string;
  price?: number;
  store?: string;
}

export interface ProductSearchProvider {
  search(query: string): Promise<ProductSearchResult[]>;
  /** Shown to the user when the provider has nothing / is not available. */
  emptyMessage: string;
}

/** Stub provider. A real one (official affiliate / product API) can be plugged in later. */
export const stubSearchProvider: ProductSearchProvider = {
  emptyMessage: "Search coming soon — paste a link for now",
  async search() {
    return [];
  },
};

export const searchProvider: ProductSearchProvider = stubSearchProvider;
