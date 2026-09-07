export type FileNode = {
  name: string;
  path: string;
  kind: 'file' | 'folder';
  children?: FileNode[];
};

export type KZApi = {
  workspace: {
    open: () => Promise<string | null>;
    readTree: (root: string) => Promise<FileNode[]>;
  };
  file: {
    read: (path: string) => Promise<string>;
    write: (path: string, content: string) => Promise<void>;
    create: (path: string, kind: 'file' | 'folder') => Promise<void>;
    remove: (path: string) => Promise<void>;
    rename: (oldPath: string, newPath: string) => Promise<void>;
  };
  terminal: {
    cwd: () => Promise<string>;
    run: (command: string, cwd?: string) => Promise<{ stdout: string; stderr: string; code: number | null }>;
  };
};
