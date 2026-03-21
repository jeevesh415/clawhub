type NormalizePackageUploadPathOptions = {
  stripTopLevelFolder?: boolean;
};

type UploadablePackageFile = {
  name: string;
  size: number;
  type: string;
  webkitRelativePath?: string;
};

const KNOWN_PACKAGE_ROOT_PATHS = new Set([
  'package.json',
  'openclaw.plugin.json',
  'openclaw.bundle.json',
  'README.md',
  'readme.md',
  'README.mdx',
  'readme.mdx',
]);

export function normalizePackageUploadPath(
  path: string,
  options: NormalizePackageUploadPathOptions = {},
) {
  const trimmed = path.trim().replace(/^\/+|\/+$/g, "");
  if (!trimmed) return "";
  const parts = trimmed.split("/").filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "";
  if (!options.stripTopLevelFolder) return parts.join("/");
  return parts.slice(1).join("/") || (parts.at(-1) ?? "");
}

function shouldStripSharedTopLevelFolder<TFile extends UploadablePackageFile>(files: TFile[]) {
  if (files.length === 0) return false;
  const partsList = files
    .map((file) => normalizePackageUploadPath(file.webkitRelativePath?.trim() || file.name))
    .filter(Boolean)
    .map((path) => path.split("/").filter(Boolean));
  if (partsList.length === 0 || partsList.some((parts) => parts.length < 2)) return false;

  const firstSegment = partsList[0]?.[0];
  if (!firstSegment) return false;
  if (!partsList.every((parts) => parts[0] === firstSegment)) return false;

  return partsList
    .map((parts) => parts.slice(1).join("/"))
    .some((path) => KNOWN_PACKAGE_ROOT_PATHS.has(path));
}

export async function buildPackageUploadEntries<TFile extends UploadablePackageFile>(
  files: TFile[],
  options: {
    generateUploadUrl: () => Promise<string>;
    hashFile: (file: TFile) => Promise<string>;
    uploadFile: (uploadUrl: string, file: TFile) => Promise<string>;
  },
) {
  const uploaded: Array<{
    path: string;
    size: number;
    storageId: string;
    sha256: string;
    contentType?: string;
  }> = [];
  const stripTopLevelFolder = shouldStripSharedTopLevelFolder(files);

  for (const file of files) {
    const sha256 = await options.hashFile(file);
    const uploadUrl = await options.generateUploadUrl();
    const storageId = await options.uploadFile(uploadUrl, file);
    const relativePath = file.webkitRelativePath?.trim() || "";
    const rawPath = relativePath || file.name;
    const path =
      normalizePackageUploadPath(rawPath, {
        stripTopLevelFolder,
      }) || file.name;
    uploaded.push({
      path,
      size: file.size,
      storageId,
      sha256,
      contentType: file.type || undefined,
    });
  }

  return uploaded;
}
