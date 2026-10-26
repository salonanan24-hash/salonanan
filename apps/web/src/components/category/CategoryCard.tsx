import { Link } from 'react-router-dom';
import type { CatalogCategory } from '@anan/shared';
import { categoryImage } from '@/data/catalog';
import { useI18n } from '@/i18n';

type CategoryCardProps = {
  category: CatalogCategory;
};

export function CategoryCard({ category }: CategoryCardProps) {
  const { locale } = useI18n();
  const image = categoryImage(category.slug);

  return (
    <Link to={`/category/${category.slug}`} className="group flex flex-col items-center gap-2.5 px-1 py-1">
      <span className="flex h-[6.5rem] w-full items-center justify-center sm:h-24 xl:h-[6.5rem]">
        <img
          src={image}
          alt=""
          width={800}
          height={800}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain transition duration-300 group-hover:-translate-y-2"
        />
      </span>
      <span className="line-clamp-2 text-center text-sm font-medium leading-5 text-ink transition-colors duration-300 group-hover:text-brand-red xl:text-[15px]">
        {category.name[locale]}
      </span>
    </Link>
  );
}
