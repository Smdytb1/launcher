import * as fs from 'fs-extra';
import { promisify } from 'util';
import { ImageFolderCache } from './ImageFolderCache';
import { getScreenshotFolderPath, getThumbnailFolderPath } from './util';
import { IGameInfo } from '../../shared/game/interfaces';
import { removeFileExtension } from '../../shared/Util';

const ensureDir = promisify(fs.ensureDir);

type PartialDict<T> = { [key: string]: T | undefined; };

export class GameImageCollection {
  private _flashpointPath: string;
  private _thumbnails: PartialDict<ImageFolderCache> = {};
  private _screenshots: PartialDict<ImageFolderCache> = {};

  constructor(flashpointPath: string) {
    this._flashpointPath = flashpointPath;
  }

  public getScreenshotCache(folderName: string): ImageFolderCache|undefined {
    return this._screenshots[folderName.toLowerCase()];
  }

  public getThumbnailCache(folderName: string): ImageFolderCache|undefined {
    return this._thumbnails[folderName.toLowerCase()];
  }

  /** Get a copy of the screenshot cache "hash map" */
  public getAllScreenshotCaches(): { [key: string]: ImageFolderCache; } {
    const cachesCopy: { [key: string]: ImageFolderCache; } = {};
    for (let key in this._screenshots) {
      const cache = this._screenshots[key];
      if (cache) { cachesCopy[key] = cache; }
    }
    return cachesCopy;
  }

  /** Get a copy of the thumbnail cache "hash map" */
  public getAllThumbnailCaches(): { [key: string]: ImageFolderCache; } {
    const cachesCopy: { [key: string]: ImageFolderCache; } = {};
    for (let key in this._thumbnails) {
      const cache = this._thumbnails[key];
      if (cache) { cachesCopy[key] = cache; }
    }
    return cachesCopy;
  }

  /**
   * Create image folder in the file system if it's missing
   * (This does not add or update the folders in the image cache)
   * @param folderName Name of folder
   */
  public async createImageFolder(folderName: string): Promise<void> {
    await ensureDir(getThumbnailFolderPath(folderName, this._flashpointPath));
    await ensureDir(getScreenshotFolderPath(folderName, this._flashpointPath));
  }
  
  /**
   * Add multiple image folders to the image collection
   * @param folderNames Names of the folders
   */
  public addImageFolders(folderNames: string[]): void {
    for (let i = 0; i < folderNames.length; i++) {
      this.addImageFolder(folderNames[i]);
    }
  }
  
  /**
   * Add an image folder to the image collection
   * @param folderName Name of the folder
   */
  public addImageFolder(folderName: string): void {
    const lowerFolderName: string = folderName.toLowerCase();
    if (this._thumbnails[lowerFolderName]) { throw new Error(`Image Folder with the same name has already been added (${folderName})`); }
    // Add thumbnail folder
    const thumbnailFolder = new ImageFolderCache();
    this._thumbnails[lowerFolderName] = thumbnailFolder;
    thumbnailFolder.loadFilenames(getThumbnailFolderPath(folderName, this._flashpointPath)).catch(console.warn);
    // Add screenshot folder
    const screenshotFolder = new ImageFolderCache();
    this._screenshots[lowerFolderName] = screenshotFolder;
    screenshotFolder.loadFilenames(getScreenshotFolderPath(folderName, this._flashpointPath)).catch(console.warn);
  }
  
  /**
   * Get the path to the thumbnail for a given game (returns undefined if not found).
   * @param game Game to get the thumbnail of.
   * @returns Path to the thumbnail for that game, or undefined if not found.
   */
  public getThumbnailPath(game: IGameInfo): string|undefined {
    return this.getImage(this._thumbnails, game);
  }
  
  /**
   * Get the path to the screenshot for a given game (returns undefined if not found).
   * @param game Game to get the screenshot of.
   * @returns Path to the screenshot for that game, or undefined if not found.
   */
  public getScreenshotPath(game: IGameInfo): string|undefined {
    return this.getImage(this._screenshots, game);
  }
  
  /** Internal shared implementation of the "get*PathOfGame" functions. */
  getImage(dict: PartialDict<ImageFolderCache>, game: IGameInfo): string|undefined {
    const cache = dict[removeFileExtension(game.filename).toLowerCase()];
    if (cache) {
      let filepath = cache.getFilePath(game.id);
      if (filepath) { return filepath; }
      filepath = cache.getFilePath(game.title);
      return filepath;
    }
    return undefined;
  }
}
