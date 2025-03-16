"use client";
//test
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { useSession } from "next-auth/react";
import CreateProjectModal from "../CreateProjectModal/CreateProjectModal";

export default function ProjectsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [userID, setUserID] = useState<string | null>(null);
  const [isModalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.id) {
      setUserID(session.user.id);
    }
  }, [session, status]);

  const {
    data: projects,
    isLoading,
    error,
  } = api.project.getProjects.useQuery(undefined, { enabled: !!userID });

  if (status === "loading")
    return <p className="text-white">Loading session...</p>;
  if (!session)
    return <p className="text-red-500">Please log in to view your projects.</p>;
  if (isLoading) return <p className="text-white">Loading projects...</p>;
  if (error) return <p className="text-red-500">Error: {error.message}</p>;

  const handleProjectClick = (projectId: number) => {
    router.push(`/projectdetails/${projectId}`);
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-gray-900 p-6"
      style={{
        backgroundColor: "#ffffff",
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 2000 1500'%3E%3Cdefs%3E%3Crect stroke='%23ffffff' stroke-width='.5' width='1' height='1' id='s'/%3E%3Cpattern id='a' width='3' height='3' patternUnits='userSpaceOnUse' patternTransform='scale(50) translate(-980 -735)'%3E%3Cuse fill='%23fcfcfc' href='%23s' y='2'/%3E%3Cuse fill='%23fcfcfc' href='%23s' x='1' y='2'/%3E%3Cuse fill='%23fafafa' href='%23s' x='2' y='2'/%3E%3Cuse fill='%23fafafa' href='%23s'/%3E%3Cuse fill='%23f7f7f7' href='%23s' x='2'/%3E%3Cuse fill='%23f7f7f7' href='%23s' x='1' y='1'/%3E%3C/pattern%3E%3Cpattern id='b' width='7' height='11' patternUnits='userSpaceOnUse' patternTransform='scale(50) translate(-980 -735)'%3E%3Cg fill='%23f5f5f5'%3E%3Cuse href='%23s'/%3E%3Cuse href='%23s' y='5' /%3E%3Cuse href='%23s' x='1' y='10'/%3E%3Cuse href='%23s' x='2' y='1'/%3E%3Cuse href='%23s' x='2' y='4'/%3E%3Cuse href='%23s' x='3' y='8'/%3E%3Cuse href='%23s' x='4' y='3'/%3E%3Cuse href='%23s' x='4' y='7'/%3E%3Cuse href='%23s' x='5' y='2'/%3E%3Cuse href='%23s' x='5' y='6'/%3E%3Cuse href='%23s' x='6' y='9'/%3E%3C/g%3E%3C/pattern%3E%3C/defs%3E%3Crect fill='url(%23a)' width='100%25' height='100%25'/%3E%3Crect fill='url(%23b)' width='100%25' height='100%25'/%3E%3C/svg%3E\")",
        backgroundAttachment: "fixed",
        backgroundSize: "cover",
      }}
    >
      <div className="w-full max-w-2xl rounded-lg bg-gray-800 p-8 shadow-lg">
        <h1 className="mb-6 text-2xl font-bold text-white">Your Projects</h1>

        {}
        <button
          onClick={() => setModalOpen(true)}
          className="mb-6 w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
        >
          Create New Project
        </button>

        {}
        {projects && projects.length > 0 ? (
          <ul className="space-y-4">
            {projects.map((project) => (
              <li
                key={project.id}
                className="cursor-pointer rounded-lg bg-gray-700 p-5 transition hover:bg-gray-600"
                onClick={() => handleProjectClick(project.id)}
              >
                <h2 className="text-lg font-semibold text-white">
                  {project.name}
                </h2>
                <p className="text-gray-300">
                  {project.description ?? "No description provided."}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-400">No projects found.</p>
        )}

        {}
        <CreateProjectModal
          isOpen={isModalOpen}
          onClose={() => setModalOpen(false)}
        />
      </div>
    </div>
  );
}
