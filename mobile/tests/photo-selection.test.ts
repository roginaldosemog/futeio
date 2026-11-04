import * as Picker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import { selectProfilePhoto } from '../src/features/players/photo-selection';

jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({ ImageManipulator: { manipulate: jest.fn() }, SaveFormat: { JPEG: 'jpeg' } }));
jest.mock('expo-file-system', () => ({ File: jest.fn() }));

const picker = jest.mocked(Picker.launchImageLibraryAsync);
const resize = jest.fn();
const releaseImage = jest.fn();
const releaseContext = jest.fn();
const save = jest.fn();
const remove = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  picker.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///selected.jpg', width: 4000, height: 3000 }] });
  save.mockResolvedValue({ uri: 'file:///generated-profile.jpg', base64: 'amVwZw==' });
  jest.mocked(File).mockImplementation(() => ({ delete: remove }) as unknown as File);
  jest.mocked(ImageManipulator.manipulate).mockReturnValue({ resize, release: releaseContext, renderAsync: async () => ({ saveAsync: save, release: releaseImage }) } as unknown as ReturnType<typeof ImageManipulator.manipulate>);
});

it('cancels without reading or writing an image', async () => {
  picker.mockResolvedValue({ canceled: true, assets: null });
  expect(await selectProfilePhoto()).toBeNull();
  expect(ImageManipulator.manipulate).not.toHaveBeenCalled();
});

it('downsamples at decode, produces JPEG and removes only its own generated file', async () => {
  expect(await selectProfilePhoto()).toBe('amVwZw==');
  expect(picker).toHaveBeenCalledWith(expect.objectContaining({ mediaTypes: ['images'], exif: false, allowsMultipleSelection: false }));
  expect(ImageManipulator.manipulate).toHaveBeenCalledWith('file:///selected.jpg', { maxWidth: 512, maxHeight: 512 });
  expect(resize).toHaveBeenCalledWith({ width: 512, height: null });
  expect(save).toHaveBeenCalledWith({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
  expect(File).toHaveBeenCalledWith('file:///generated-profile.jpg');
  expect(File).not.toHaveBeenCalledWith('file:///selected.jpg');
  expect(remove).toHaveBeenCalledTimes(1);
  expect(releaseImage).toHaveBeenCalled(); expect(releaseContext).toHaveBeenCalled();
});

it('rejects nonlocal picker output without fetching an arbitrary image URL', async () => {
  picker.mockResolvedValue({ canceled: false, assets: [{ uri: 'https://untrusted.example/image.jpg', width: 400, height: 400 }] });
  await expect(selectProfilePhoto()).rejects.toThrow();
  expect(ImageManipulator.manipulate).not.toHaveBeenCalled();
});

it('rejects oversized results and still cleans up the generated file and native references', async () => {
  save.mockResolvedValue({ uri: 'file:///generated-profile.jpg', base64: 'a'.repeat(2_796_205) });
  await expect(selectProfilePhoto()).rejects.toThrow('Escolha uma foto menor');
  expect(remove).toHaveBeenCalled(); expect(releaseImage).toHaveBeenCalled(); expect(releaseContext).toHaveBeenCalled();
});
