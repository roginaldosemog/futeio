"use client";

import { useRef, useState, type FormEvent } from "react";
import { buttonClass, inputClass, secondaryClass } from "../access/private-workspace";
import { AccessError } from "@/lib/api-client";
import { removePhoto, updatePlayer, uploadPhoto } from "./players-client";

export function RatingForm({
  current,
  pending,
  onSave,
}: {
  current?: number;
  pending: boolean;
  onSave: (rating: number) => Promise<void>;
}) {
  const [rating, setRating] = useState(current?.toString() ?? "");
  const lock = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rating === "" || pending || lock.current) return;
    lock.current = true;
    try {
      await onSave(Number(rating));
    } finally {
      lock.current = false;
    }
  }
  return (
    <form onSubmit={submit} aria-busy={pending}>
      <div className="max-w-xs">
        <label className="block font-semibold" htmlFor="player-rating">
          Sua nota para este jogador
        </label>
        <select
          id="player-rating"
          required
          className={inputClass}
          value={rating}
          onChange={(event) => setRating(event.target.value)}
          disabled={pending}
        >
          <option value="" disabled>
            Selecione de 0 a 10
          </option>
          {Array.from({ length: 11 }, (_, value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-[#3c5b4b]">
        {current === undefined
          ? "Você ainda não avaliou este jogador."
          : `Sua nota vigente é ${current}. Uma nova nota substitui a anterior.`}
      </p>
      <button className={`${buttonClass} mt-5`} disabled={pending || rating === ""} type="submit">
        {pending
          ? "Salvando avaliação..."
          : current === undefined
            ? "Salvar avaliação"
            : "Atualizar avaliação"}
      </button>
    </form>
  );
}

export function ProfileEditor({
  id,
  name,
  hasPhoto,
  onSaved,
  onFailure,
}: {
  id: string;
  name: string;
  hasPhoto: boolean;
  onSaved: () => Promise<void>;
  onFailure: (error: unknown) => void;
}) {
  const [newName, setNewName] = useState(name);
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  async function run(operation: () => Promise<void>, message: string) {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError(undefined);
    setNotice(undefined);
    try {
      await operation();
      await onSaved();
      setNotice(message);
    } catch (failure) {
      onFailure(failure);
      setError(
        failure instanceof AccessError && failure.status === 400
          ? "Confira os dados. A foto deve ser uma imagem JPEG ou PNG válida de até 2 MB."
          : "Não foi possível salvar a alteração. Confira o perfil e tente novamente.",
      );
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(() => updatePlayer(id, newName.trim()), "Nome atualizado.");
  }
  async function savePhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    if (file.size > 2 * 1024 * 1024 || !["image/jpeg", "image/png"].includes(file.type)) {
      setError("Escolha uma foto JPEG ou PNG de até 2 MB.");
      return;
    }
    await run(async () => {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          typeof reader.result === "string"
            ? resolve(reader.result.split(",")[1] ?? "")
            : reject(new Error("Image unreadable"));
        reader.onerror = () => reject(new Error("Image unreadable"));
        reader.readAsDataURL(file);
      });
      await uploadPhoto(id, data);
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
    }, "Foto atualizada.");
  }
  return (
    <section
      aria-labelledby="edit-profile-heading"
      className="mt-12 border-t border-[#d6e2db] pt-8"
      aria-busy={pending}
    >
      <h2 id="edit-profile-heading" className="text-2xl font-bold">
        Editar perfil
      </h2>
      <form className="mt-6" onSubmit={saveName}>
        <label className="block max-w-md font-semibold" htmlFor="profile-name">
          Nome
          <input
            id="profile-name"
            className={inputClass}
            required
            maxLength={100}
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            disabled={pending}
            autoComplete="name"
          />
        </label>
        <button
          type="submit"
          className={`${buttonClass} mt-4`}
          disabled={pending || !newName.trim()}
        >
          Salvar nome
        </button>
      </form>
      <form className="mt-8" onSubmit={savePhoto}>
        <label className="block font-semibold" htmlFor="profile-photo">
          Foto do perfil
          <input
            ref={fileInput}
            id="profile-photo"
            type="file"
            accept="image/jpeg,image/png"
            className="mt-3 block w-full max-w-lg text-sm file:mr-4 file:min-h-12 file:rounded-xl file:border file:border-[#6b8576] file:bg-white file:px-4 file:py-3 file:font-semibold file:text-[#163b2a]"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setError(undefined);
            }}
            disabled={pending}
          />
        </label>
        <p className="mt-3 text-sm leading-relaxed text-[#3c5b4b]">
          JPEG ou PNG, até 2 MB. A foto fica visível apenas para o grupo.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="submit" className={buttonClass} disabled={pending || !file}>
            Enviar foto
          </button>
          {hasPhoto ? (
            <button
              type="button"
              className={secondaryClass}
              disabled={pending}
              onClick={() => void run(() => removePhoto(id), "Foto removida.")}
            >
              Remover foto
            </button>
          ) : null}
        </div>
      </form>
      {notice ? (
        <p role="status" className="mt-5">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-5 text-[#8b3028]">
          {error}
        </p>
      ) : null}
    </section>
  );
}
