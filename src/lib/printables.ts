import type { SearchResult, ModelFile } from "../types.js";

const GRAPHQL_URL = "https://api.printables.com/graphql/";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

async function gql(query: string, variables: Record<string, unknown> = {}): Promise<unknown> {
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`Printables API ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { data?: unknown; errors?: { message: string }[] };
  if (json.errors?.length) {
    throw new Error(`Printables GraphQL: ${json.errors.map((e) => e.message).join(", ")}`);
  }
  return json.data;
}

export async function searchPrintables(
  query: string,
  limit = 10,
  ordering = "best_match",
): Promise<SearchResult[]> {
  const data = (await gql(
    `query SearchModels($query: String!, $limit: Int!) {
      result: searchPrints2(
        query: $query
        limit: $limit
      ) {
        items {
          id
          name
          slug
          user { publicUsername }
          image { filePath }
          downloadCount
        }
      }
    }`,
    { query, limit },
  )) as {
    result: {
      items: {
        id: number;
        name: string;
        slug: string;
        user: { publicUsername: string };
        image: { filePath: string } | null;
        downloadCount: number;
      }[];
    };
  };

  return data.result.items.map((item) => ({
    id: String(item.id),
    name: item.name,
    author: item.user.publicUsername,
    thumbnailUrl: item.image?.filePath
      ? `https://media.printables.com/${item.image.filePath}`
      : null,
    downloadCount: item.downloadCount,
    source: "printables" as const,
    url: `https://www.printables.com/model/${item.id}-${item.slug}`,
  }));
}

export async function getModelFiles(modelId: string): Promise<ModelFile[]> {
  const data = (await gql(
    `query ModelFiles($id: ID!) {
      print(id: $id) {
        stls {
          id
          name
          fileSize
        }
      }
    }`,
    { id: modelId },
  )) as {
    print: {
      stls: { id: number; name: string; fileSize: number }[];
    };
  };

  return data.print.stls.map((f) => ({
    id: String(f.id),
    name: f.name,
    sizeBytes: f.fileSize,
  }));
}

export async function getDownloadUrl(fileId: string, printId: string): Promise<string> {
  const data = (await gql(
    `mutation GetDownloadLink($id: ID!, $printId: ID!, $source: DownloadSourceEnum!, $fileType: DownloadFileTypeEnum!) {
      getDownloadLink(id: $id, printId: $printId, source: $source, fileType: $fileType) {
        ok
        errors { field messages }
        output {
          link
        }
      }
    }`,
    { id: fileId, printId, source: "model_detail", fileType: "stl" },
  )) as {
    getDownloadLink: {
      ok: boolean;
      errors: { field: string; messages: string[] }[] | null;
      output: { link: string } | null;
    };
  };

  if (!data.getDownloadLink.ok || !data.getDownloadLink.output?.link) {
    const errMsg = data.getDownloadLink.errors?.map((e) => `${e.field}: ${e.messages.join(", ")}`).join("; ") || "unknown error";
    throw new Error(`Failed to get download link: ${errMsg}`);
  }
  return data.getDownloadLink.output.link;
}
